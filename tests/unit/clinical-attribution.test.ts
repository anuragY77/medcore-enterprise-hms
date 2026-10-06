// Phase 21: clinical attribution forgery fix.
//
// Four clinical POST routes persisted the client-supplied identity field
// (prescribedBy / recordedBy / doctorName), so any user with patients:write
// could stamp a record with a colleague's name. The routes now persist the
// authenticated session name server-side; these tests fail if the fix is
// reverted to the client-supplied value. Records/vitals also gained audit
// entries (they previously wrote none).
import { beforeEach, describe, expect, it, vi } from "vitest";

const dbCtl = vi.hoisted(() => ({
  selectRows: [] as unknown[],
  insertValues: [] as unknown[],
  insertRow: null as unknown,
}));

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn() }));
vi.mock("@/lib/db", () => {
  const tableStub = () =>
    new Proxy(
      {},
      {
        get: (_target, prop) =>
          typeof prop === "symbol" ? undefined : String(prop),
      }
    );

  const makeChain = (result: unknown) => {
    const chain: Record<string, unknown> = {};
    for (const method of [
      "from",
      "where",
      "orderBy",
      "limit",
      "offset",
      "groupBy",
      "for",
      "returning",
    ]) {
      chain[method] = () => chain;
    }
    chain.values = (values: unknown) => {
      dbCtl.insertValues.push(values);
      return chain;
    };
    chain.then = (
      onFulfilled: (value: unknown) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => Promise.resolve(result).then(onFulfilled, onRejected);
    return chain;
  };

  return {
    db: {
      select: () => makeChain(dbCtl.selectRows),
      insert: () => makeChain([dbCtl.insertRow]),
    },
    patients: tableStub(),
    prescriptions: tableStub(),
    medicalRecords: tableStub(),
    vitals: tableStub(),
    consultations: tableStub(),
  };
});

import { auth } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { POST as postPrescription } from "@/app/api/patients/[id]/prescriptions/route";
import { POST as postRecord } from "@/app/api/patients/[id]/records/route";
import { POST as postVital } from "@/app/api/patients/[id]/vitals/route";
import { POST as postConsultation } from "@/app/api/patients/[id]/consultations/route";

const authMock = vi.mocked(auth);
const auditMock = vi.mocked(recordAudit);

const PATIENT_ID = "3f1d2a7c-9b64-4e21-8a5f-1c2d3e4f5a6b";

type TestSession = {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    department: string;
  };
  sessionId: string;
  authAt: number;
};

function session(user: Partial<TestSession["user"]>): TestSession {
  return {
    user: {
      id: "usr_clinical_1",
      name: "Dr. Adaeze Okonkwo",
      email: "adaeze@medcore.test",
      role: "DOCTOR",
      department: "Cardiology",
      ...user,
    },
    sessionId: "sid-clinical-1",
    authAt: 1_700_000_000,
  };
}

type NextRequestInit = ConstructorParameters<
  typeof import("next/server").NextRequest
>[1];

async function postJson(
  handler: (
    request: import("next/server").NextRequest,
    context: { params: Promise<{ id: string }> }
  ) => Promise<Response>,
  body: unknown,
  options: { session?: TestSession | null } = {}
): Promise<Response> {
  const { NextRequest } = await import("next/server");
  authMock.mockResolvedValue(
    (options.session === undefined ? session({}) : options.session) as Awaited<
      ReturnType<typeof auth>
    >
  );
  const request = new NextRequest(
    `http://localhost:3000/api/patients/${PATIENT_ID}/prescriptions`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      duplex: "half",
    } as unknown as NextRequestInit
  );
  return handler(request, { params: Promise.resolve({ id: PATIENT_ID }) });
}

describe("clinical attribution is server-authoritative (Phase 21)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbCtl.selectRows = [{ id: PATIENT_ID }];
    dbCtl.insertValues = [];
    dbCtl.insertRow = {};
  });

  it("prescriptions: persists the session name, not the client-supplied doctor", async () => {
    dbCtl.insertRow = {
      id: "rx-1",
      patientId: PATIENT_ID,
      consultationId: null,
      status: "Active",
    };
    const res = await postJson(postPrescription, {
      medicationName: "Amoxicillin",
      dosage: "500mg",
      frequency: "3x daily",
      prescribedBy: "Dr. Forged Identity",
    });
    expect(res.status).toBe(201);
    const values = dbCtl.insertValues[0] as { prescribedBy: string };
    expect(values.prescribedBy).toBe("Dr. Adaeze Okonkwo");
    expect(values.prescribedBy).not.toBe("Dr. Forged Identity");
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "prescription.create" })
    );
  });

  it("prescriptions: returns 401 without a session and writes nothing", async () => {
    const res = await postJson(
      postPrescription,
      { medicationName: "X", dosage: "1mg", frequency: "daily", prescribedBy: "Y" },
      { session: null }
    );
    expect(res.status).toBe(401);
    expect(dbCtl.insertValues).toHaveLength(0);
    expect(auditMock).not.toHaveBeenCalled();
  });

  it("medical records: persists the session name and records an audit entry", async () => {
    dbCtl.insertRow = {
      id: "rec-1",
      patientId: PATIENT_ID,
      recordType: "Clinical",
      title: "Progress note",
    };
    const res = await postJson(postRecord, {
      recordType: "Clinical",
      title: "Progress note",
      recordedBy: "Nurse Forged Identity",
    });
    expect(res.status).toBe(201);
    const values = dbCtl.insertValues[0] as { recordedBy: string };
    expect(values.recordedBy).toBe("Dr. Adaeze Okonkwo");
    expect(values.recordedBy).not.toBe("Nurse Forged Identity");
    expect(auditMock).toHaveBeenCalledTimes(1);
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "medical_record.create",
        actorId: "usr_clinical_1",
      })
    );
  });

  it("vitals: persists the session name and records an audit entry", async () => {
    dbCtl.insertRow = {
      id: "vit-1",
      patientId: PATIENT_ID,
      recordedAt: new Date().toISOString(),
    };
    const res = await postJson(postVital, {
      heartRate: 72,
      recordedBy: "Nurse Forged Identity",
    });
    expect(res.status).toBe(201);
    const values = dbCtl.insertValues[0] as { recordedBy: string };
    expect(values.recordedBy).toBe("Dr. Adaeze Okonkwo");
    expect(values.recordedBy).not.toBe("Nurse Forged Identity");
    expect(auditMock).toHaveBeenCalledTimes(1);
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "vital.create" })
    );
  });

  it("consultations: persists the session name, not the client-supplied doctor", async () => {
    dbCtl.insertRow = {
      id: "con-1",
      patientId: PATIENT_ID,
      appointmentId: null,
    };
    const res = await postJson(postConsultation, {
      doctorName: "Dr. Forged Identity",
      chiefComplaint: "Chest pain",
      diagnosis: "Stable angina",
    });
    expect(res.status).toBe(201);
    const values = dbCtl.insertValues[0] as { doctorName: string };
    expect(values.doctorName).toBe("Dr. Adaeze Okonkwo");
    expect(values.doctorName).not.toBe("Dr. Forged Identity");
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "consultation.create" })
    );
  });

  it("uses the session identity even when it differs from the appointment context role", async () => {
    dbCtl.insertRow = {
      id: "con-2",
      patientId: PATIENT_ID,
      appointmentId: null,
    };
    const nurseSession = session({
      id: "usr_nurse_9",
      name: "Nurse Chidi Bello",
      role: "NURSE",
      department: "Emergency",
    });
    const res = await postJson(postConsultation, {
      doctorName: "Dr. Someone Else",
      chiefComplaint: "Fever",
      diagnosis: "Viral syndrome",
    }, { session: nurseSession });
    expect(res.status).toBe(201);
    const values = dbCtl.insertValues[0] as { doctorName: string };
    expect(values.doctorName).toBe("Nurse Chidi Bello");
  });
});
