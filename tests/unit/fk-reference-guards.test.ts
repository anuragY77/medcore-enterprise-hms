// Phase 22: foreign-key reference guards.
//
// POST/PUT /api/appointments, /api/emergency, and /api/surgeries inserted
// caller-supplied UUIDs straight into foreign keys: a nonexistent patient,
// doctor, or surgeon id reached PostgreSQL (23503 -> 500), and the same
// applied to POST /api/patients/[id]/prescriptions with consultationId,
// which additionally allowed attaching a prescription to another patient's
// consultation (cross-patient PHI linkage). These tests fail if any of the
// existence/consistency checks are removed.
import { beforeEach, describe, expect, it, vi } from "vitest";

const dbCtl = vi.hoisted(() => ({
  selectQueue: [] as unknown[][],
  insertValues: [] as unknown[],
  updateValues: [] as unknown[],
  insertRow: null as unknown,
  updateRow: null as unknown,
}));

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn() }));
vi.mock("@/lib/business-id", () => ({
  nextBusinessId: vi.fn(async (prefix: string) => `${prefix}-999999`),
}));
vi.mock("@/lib/notifications", () => ({
  resolveUserByName: vi.fn(async () => []),
  resolveUsersByDepartmentRole: vi.fn(async () => []),
  recordNotifications: vi.fn(async () => {}),
}));
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
    chain.set = (values: unknown) => {
      dbCtl.updateValues.push(values);
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
      select: () => makeChain(dbCtl.selectQueue.shift() ?? []),
      insert: () => makeChain([dbCtl.insertRow]),
      update: () => makeChain([dbCtl.updateRow]),
    },
    appointments: tableStub(),
    emergencyCases: tableStub(),
    surgeries: tableStub(),
    patients: tableStub(),
    staff: tableStub(),
    prescriptions: tableStub(),
    consultations: tableStub(),
  };
});

import { auth } from "@/lib/auth";
import { POST as postAppointment } from "@/app/api/appointments/route";
import { PUT as putAppointment } from "@/app/api/appointments/[id]/route";
import { POST as postEmergency } from "@/app/api/emergency/route";
import { PUT as putEmergency } from "@/app/api/emergency/[id]/route";
import { POST as postSurgery } from "@/app/api/surgeries/route";
import { PUT as putSurgery } from "@/app/api/surgeries/[id]/route";
import { POST as postPrescription } from "@/app/api/patients/[id]/prescriptions/route";

const authMock = vi.mocked(auth);

const PATIENT_ID = "3f1d2a7c-9b64-4e21-8a5f-1c2d3e4f5a6b";
const OTHER_PATIENT_ID = "9e8d7c6b-5a49-4382-b1a0-f9e8d7c6b5a4";
const STAFF_ID = "1a2b3c4d-5e6f-4a8b-9c0d-1e2f3a4b5c6d";
const CONSULTATION_ID = "7f6e5d4c-3b2a-4c1d-8e9f-0a1b2c3d4e5f";
const ENTITY_ID = "aa11bb22-cc33-4d44-8e55-ff6677889900";

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

function adminSession(): TestSession {
  return {
    user: {
      id: "usr_fk_1",
      name: "Test Admin",
      email: "admin@medcore.test",
      role: "ADMIN",
      department: "Administration",
    },
    sessionId: "sid-fk-1",
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
  entityId: string = ENTITY_ID
): Promise<Response> {
  const { NextRequest } = await import("next/server");
  authMock.mockResolvedValue(
    adminSession() as Awaited<ReturnType<typeof auth>>
  );
  const request = new NextRequest(
    `http://localhost:3000/api/test`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      duplex: "half",
    } as unknown as NextRequestInit
  );
  return handler(request, { params: Promise.resolve({ id: entityId }) });
}

async function putJson(
  handler: (
    request: import("next/server").NextRequest,
    context: { params: Promise<{ id: string }> }
  ) => Promise<Response>,
  body: unknown
): Promise<Response> {
  return postJson(handler, body, ENTITY_ID);
}

const existingAppointment = {
  id: ENTITY_ID,
  appointmentId: "APT-0001",
  patientId: PATIENT_ID,
  doctorName: "Dr. Ada",
  department: "Cardiology",
  date: new Date("2026-10-10T00:00:00.000Z"),
  time: "10:00",
  type: "Consultation",
  status: "Scheduled",
  reason: null,
  notes: null,
};

const existingCase = {
  id: ENTITY_ID,
  caseId: "EMC-0001",
  patientId: PATIENT_ID,
  doctorId: null,
  arrivalTime: new Date("2026-10-06T10:00:00.000Z"),
  triageLevel: 2,
  status: "Waiting",
  chiefComplaint: "Chest pain",
  diagnosis: null,
  treatment: null,
  notes: null,
};

const existingSurgery = {
  id: ENTITY_ID,
  surgeryId: "SRG-0001",
  patientId: PATIENT_ID,
  surgeonId: STAFF_ID,
  procedureName: "Bypass",
  procedureType: "Cardiac",
  surgeryDate: new Date("2026-10-15T00:00:00.000Z"),
  estimatedDuration: 120,
  operatingRoom: null,
  department: "Cardiology",
  status: "Scheduled",
  preOpNotes: null,
  postOpNotes: null,
  complications: null,
  anesthesiaType: null,
  notes: null,
};

const validAppointmentBody = {
  patientId: PATIENT_ID,
  doctorName: "Dr. Ada",
  department: "Cardiology",
  date: "2026-10-10",
  time: "10:00",
  type: "Consultation",
  status: "Scheduled",
};

const validEmergencyBody = {
  patientId: PATIENT_ID,
  doctorId: STAFF_ID,
  arrivalTime: "2026-10-06T10:00:00.000Z",
  triageLevel: 2,
  status: "Waiting",
  chiefComplaint: "Chest pain",
};

const validSurgeryBody = {
  patientId: PATIENT_ID,
  surgeonId: STAFF_ID,
  procedureName: "Bypass",
  procedureType: "Cardiac",
  surgeryDate: "2026-10-15",
  department: "Cardiology",
  status: "Scheduled",
};

const validPrescriptionBody = {
  medicationName: "Amoxicillin",
  dosage: "500mg",
  frequency: "3x daily",
  prescribedBy: "Dr. Ada",
};

beforeEach(() => {
  vi.clearAllMocks();
  dbCtl.selectQueue = [];
  dbCtl.insertValues = [];
  dbCtl.updateValues = [];
  dbCtl.insertRow = null;
  dbCtl.updateRow = null;
});

describe("appointments reference guards (Phase 22)", () => {
  it("POST rejects a nonexistent patient with 404 and inserts nothing", async () => {
    dbCtl.selectQueue = [[]];
    const res = await postJson(postAppointment, validAppointmentBody);
    expect(res.status).toBe(404);
    expect(dbCtl.insertValues).toHaveLength(0);
  });

  it("POST creates the appointment when the patient exists", async () => {
    dbCtl.selectQueue = [[{ id: PATIENT_ID }]];
    dbCtl.insertRow = {
      id: ENTITY_ID,
      ...validAppointmentBody,
      appointmentId: "APT-999999",
      date: new Date("2026-10-10T00:00:00.000Z"),
      reason: null,
      notes: null,
    };
    const res = await postJson(postAppointment, validAppointmentBody);
    expect(res.status).toBe(201);
    expect(dbCtl.insertValues).toHaveLength(1);
  });

  it("PUT rejects a re-pointed patient that does not exist with 404", async () => {
    dbCtl.selectQueue = [[existingAppointment], []];
    const res = await putJson(putAppointment, { patientId: OTHER_PATIENT_ID });
    expect(res.status).toBe(404);
    expect(dbCtl.updateValues).toHaveLength(0);
  });

  it("PUT updates when the re-pointed patient exists", async () => {
    dbCtl.selectQueue = [[existingAppointment], [{ id: OTHER_PATIENT_ID }]];
    dbCtl.updateRow = { ...existingAppointment, patientId: OTHER_PATIENT_ID };
    const res = await putJson(putAppointment, { patientId: OTHER_PATIENT_ID });
    expect(res.status).toBe(200);
    expect(dbCtl.updateValues).toHaveLength(1);
  });
});

describe("emergency case reference guards (Phase 22)", () => {
  it("POST rejects a nonexistent patient with 404 and inserts nothing", async () => {
    dbCtl.selectQueue = [[]];
    const res = await postJson(postEmergency, validEmergencyBody);
    expect(res.status).toBe(404);
    expect(dbCtl.insertValues).toHaveLength(0);
  });

  it("POST rejects a nonexistent doctor with 404 and inserts nothing", async () => {
    dbCtl.selectQueue = [[{ id: PATIENT_ID }], []];
    const res = await postJson(postEmergency, validEmergencyBody);
    expect(res.status).toBe(404);
    expect(dbCtl.insertValues).toHaveLength(0);
  });

  it("POST creates the case when both references exist", async () => {
    dbCtl.selectQueue = [[{ id: PATIENT_ID }], [{ id: STAFF_ID }]];
    dbCtl.insertRow = {
      id: ENTITY_ID,
      caseId: "EMC-999999",
      ...validEmergencyBody,
      arrivalTime: new Date("2026-10-06T10:00:00.000Z"),
      diagnosis: null,
      treatment: null,
      notes: null,
    };
    const res = await postJson(postEmergency, validEmergencyBody);
    expect(res.status).toBe(201);
    expect(dbCtl.insertValues).toHaveLength(1);
  });

  it("PUT rejects a re-pointed patient that does not exist with 404", async () => {
    dbCtl.selectQueue = [[existingCase], []];
    const res = await putJson(putEmergency, { patientId: OTHER_PATIENT_ID });
    expect(res.status).toBe(404);
    expect(dbCtl.updateValues).toHaveLength(0);
  });

  it("PUT rejects a re-pointed doctor that does not exist with 404", async () => {
    dbCtl.selectQueue = [[existingCase], []];
    const res = await putJson(putEmergency, { doctorId: OTHER_PATIENT_ID });
    expect(res.status).toBe(404);
    expect(dbCtl.updateValues).toHaveLength(0);
  });
});

describe("surgery reference guards (Phase 22)", () => {
  it("POST rejects a nonexistent patient with 404 and inserts nothing", async () => {
    dbCtl.selectQueue = [[]];
    const res = await postJson(postSurgery, validSurgeryBody);
    expect(res.status).toBe(404);
    expect(dbCtl.insertValues).toHaveLength(0);
  });

  it("POST rejects a nonexistent surgeon with 404 and inserts nothing", async () => {
    dbCtl.selectQueue = [[{ id: PATIENT_ID }], []];
    const res = await postJson(postSurgery, validSurgeryBody);
    expect(res.status).toBe(404);
    expect(dbCtl.insertValues).toHaveLength(0);
  });

  it("POST creates the surgery when both references exist", async () => {
    dbCtl.selectQueue = [[{ id: PATIENT_ID }], [{ id: STAFF_ID }]];
    dbCtl.insertRow = {
      id: ENTITY_ID,
      surgeryId: "SRG-999999",
      ...validSurgeryBody,
      surgeryDate: new Date("2026-10-15T00:00:00.000Z"),
      estimatedDuration: null,
      operatingRoom: null,
      preOpNotes: null,
      postOpNotes: null,
      complications: null,
      anesthesiaType: null,
      notes: null,
    };
    const res = await postJson(postSurgery, validSurgeryBody);
    expect(res.status).toBe(201);
    expect(dbCtl.insertValues).toHaveLength(1);
  });

  it("PUT rejects a re-pointed patient that does not exist with 404", async () => {
    dbCtl.selectQueue = [[existingSurgery], []];
    const res = await putJson(putSurgery, { patientId: OTHER_PATIENT_ID });
    expect(res.status).toBe(404);
    expect(dbCtl.updateValues).toHaveLength(0);
  });

  it("PUT rejects a re-pointed surgeon that does not exist with 404", async () => {
    dbCtl.selectQueue = [[existingSurgery], []];
    const res = await putJson(putSurgery, { surgeonId: OTHER_PATIENT_ID });
    expect(res.status).toBe(404);
    expect(dbCtl.updateValues).toHaveLength(0);
  });
});

describe("prescription consultation consistency (Phase 22)", () => {
  it("rejects a consultation that does not exist with 404", async () => {
    dbCtl.selectQueue = [[{ id: PATIENT_ID }], []];
    const res = await postJson(postPrescription, {
      ...validPrescriptionBody,
      consultationId: CONSULTATION_ID,
    }, PATIENT_ID);
    expect(res.status).toBe(404);
    expect(dbCtl.insertValues).toHaveLength(0);
  });

  it("rejects another patient's consultation with 409 (no cross-patient link)", async () => {
    dbCtl.selectQueue = [
      [{ id: PATIENT_ID }],
      [{ id: CONSULTATION_ID, patientId: OTHER_PATIENT_ID }],
    ];
    const res = await postJson(postPrescription, {
      ...validPrescriptionBody,
      consultationId: CONSULTATION_ID,
    }, PATIENT_ID);
    expect(res.status).toBe(409);
    expect(dbCtl.insertValues).toHaveLength(0);
  });

  it("creates the prescription when the consultation belongs to the patient", async () => {
    dbCtl.selectQueue = [
      [{ id: PATIENT_ID }],
      [{ id: CONSULTATION_ID, patientId: PATIENT_ID }],
    ];
    dbCtl.insertRow = {
      id: ENTITY_ID,
      patientId: PATIENT_ID,
      consultationId: CONSULTATION_ID,
      status: "Active",
    };
    const res = await postJson(postPrescription, {
      ...validPrescriptionBody,
      consultationId: CONSULTATION_ID,
    }, PATIENT_ID);
    expect(res.status).toBe(201);
    expect(dbCtl.insertValues).toHaveLength(1);
  });

  it("still creates a prescription without a consultation", async () => {
    dbCtl.selectQueue = [[{ id: PATIENT_ID }]];
    dbCtl.insertRow = {
      id: ENTITY_ID,
      patientId: PATIENT_ID,
      consultationId: null,
      status: "Active",
    };
    const res = await postJson(postPrescription, validPrescriptionBody, PATIENT_ID);
    expect(res.status).toBe(201);
    expect(dbCtl.insertValues).toHaveLength(1);
  });
});
