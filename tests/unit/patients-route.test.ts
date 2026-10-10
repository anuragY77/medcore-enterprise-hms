// Phase 21: patients endpoint validation + status workflow gate.
//
// POST /api/patients previously destructured the raw body with a hand-rolled
// required-fields check and validated only dateOfBirth, so arbitrary strings
// (status, gender, oversized fields) reached the database. PUT /api/patients/
// [id] accepted an enum-valid `status` directly, bypassing the
// admission/discharge workflow endpoints that own bed bookkeeping and
// per-transition audits. These tests fail if either fix is reverted.
import { beforeEach, describe, expect, it, vi } from "vitest";

const dbCtl = vi.hoisted(() => ({
  // Phase 28: the reference validation issues its departments/staff selects
  // before the insert; queue each result in call order (empty queue falls
  // back to selectRows for the older assertions).
  queue: [] as unknown[],
  selectRows: [] as unknown[],
  insertValues: [] as unknown[],
  updateValues: [] as unknown[],
  insertRow: null as unknown,
  updateRow: null as unknown,
}));

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn() }));
vi.mock("@/lib/business-id", () => ({
  nextBusinessId: vi.fn(async () => "PT-900001"),
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
      select: () =>
        makeChain(
          dbCtl.queue.length > 0 ? dbCtl.queue.shift() : dbCtl.selectRows
        ),
      insert: () => makeChain([dbCtl.insertRow]),
      update: () => makeChain([dbCtl.updateRow]),
    },
    departments: tableStub(),
    staff: tableStub(),
    patients: tableStub(),
    patientAllergies: tableStub(),
    patientConditions: tableStub(),
    patientMedications: tableStub(),
    beds: tableStub(),
  };
});

import { auth } from "@/lib/auth";
import { nextBusinessId } from "@/lib/business-id";
import { POST as postPatient } from "@/app/api/patients/route";
import { PUT as putPatient } from "@/app/api/patients/[id]/route";

const authMock = vi.mocked(auth);
const businessIdMock = vi.mocked(nextBusinessId);

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

function session(role: string): TestSession {
  return {
    user: {
      id: "usr_patients_1",
      name: "Test Admin",
      email: "admin@medcore.test",
      role,
      department: "Administration",
    },
    sessionId: "sid-patients-1",
    authAt: 1_700_000_000,
  };
}

type NextRequestInit = ConstructorParameters<
  typeof import("next/server").NextRequest
>[1];

async function callJson(
  handler: (
    request: import("next/server").NextRequest,
    context: { params: Promise<{ id: string }> }
  ) => Promise<Response>,
  options: {
    url: string;
    method: "POST" | "PUT";
    body?: unknown;
    session?: TestSession | null;
  }
): Promise<Response> {
  const { NextRequest } = await import("next/server");
  authMock.mockResolvedValue(
    (options.session === undefined
      ? session("ADMIN")
      : options.session) as Awaited<ReturnType<typeof auth>>
  );
  const request = new NextRequest(options.url, {
    method: options.method,
    headers: { "content-type": "application/json" },
    ...(options.body !== undefined
      ? { body: JSON.stringify(options.body), duplex: "half" as const }
      : {}),
  } as unknown as NextRequestInit);
  return handler(request, { params: Promise.resolve({ id: PATIENT_ID }) });
}

const VALID_BODY = {
  firstName: "Ada",
  lastName: "Obi",
  dateOfBirth: "1990-04-12",
  gender: "Female",
  phone: "+2348012345678",
  email: "ada@example.com",
  department: "Cardiology",
  attendingDoctor: "Dr. Chidi Eze",
};

describe("POST /api/patients applies the full schema (Phase 21)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbCtl.queue = [];
    dbCtl.selectRows = [];
    dbCtl.insertValues = [];
    dbCtl.updateValues = [];
    dbCtl.insertRow = { id: "pat-new", patientId: "PT-900001", status: "Active" };
    dbCtl.updateRow = null;
  });

  it("rejects a status outside the workflow enum", async () => {
    const res = await callJson(postPatient, {
      url: "http://localhost:3000/api/patients",
      method: "POST",
      body: { ...VALID_BODY, status: "Deceased" },
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as {
      details?: Record<string, string[] | undefined>;
    };
    expect(body.details?.status?.length).toBeGreaterThan(0);
    expect(dbCtl.insertValues).toHaveLength(0);
  });

  it("rejects an invalid gender", async () => {
    const res = await callJson(postPatient, {
      url: "http://localhost:3000/api/patients",
      method: "POST",
      body: { ...VALID_BODY, gender: "Robot" },
    });
    expect(res.status).toBe(400);
    expect(dbCtl.insertValues).toHaveLength(0);
  });

  it("rejects a missing required field", async () => {
    const withoutName: Record<string, unknown> = { ...VALID_BODY };
    delete withoutName.firstName;
    const res = await callJson(postPatient, {
      url: "http://localhost:3000/api/patients",
      method: "POST",
      body: withoutName,
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as {
      details?: Record<string, string[] | undefined>;
    };
    expect(body.details?.firstName?.length).toBeGreaterThan(0);
    expect(dbCtl.insertValues).toHaveLength(0);
  });

  it("rejects an oversized first name (>100 chars)", async () => {
    const res = await callJson(postPatient, {
      url: "http://localhost:3000/api/patients",
      method: "POST",
      body: { ...VALID_BODY, firstName: "A".repeat(101) },
    });
    expect(res.status).toBe(400);
    expect(dbCtl.insertValues).toHaveLength(0);
  });

  it("rejects a non-string phone number", async () => {
    const res = await callJson(postPatient, {
      url: "http://localhost:3000/api/patients",
      method: "POST",
      body: { ...VALID_BODY, phone: 12345 },
    });
    expect(res.status).toBe(400);
    expect(dbCtl.insertValues).toHaveLength(0);
  });

  it("accepts a conforming payload, defaults status, and allocates a business id", async () => {
    // Reference validation queries departments, then active clinical staff.
    dbCtl.queue = [
      [{ name: "Cardiology" }],
      [{ firstName: "Chidi", lastName: "Eze" }],
    ];
    const res = await callJson(postPatient, {
      url: "http://localhost:3000/api/patients",
      method: "POST",
      body: VALID_BODY,
    });
    expect(res.status).toBe(201);
    expect(businessIdMock).toHaveBeenCalledWith(expect.anything(), "PT");
    const values = dbCtl.insertValues[0] as { status: string };
    expect(values.status).toBe("Active");
  });

  it("rejects a department absent from reference data without inserting (Phase 28)", async () => {
    dbCtl.queue = [
      [{ name: "Cardiology" }],
      [{ firstName: "Chidi", lastName: "Eze" }],
    ];
    const res = await callJson(postPatient, {
      url: "http://localhost:3000/api/patients",
      method: "POST",
      body: { ...VALID_BODY, department: "Dermatology" },
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as {
      details?: Record<string, string[] | undefined>;
    };
    expect(body.details?.department).toEqual(["Department does not exist"]);
    expect(dbCtl.insertValues).toHaveLength(0);
    expect(businessIdMock).not.toHaveBeenCalled();
  });

  it("rejects an attending doctor absent from reference data without inserting (Phase 28)", async () => {
    dbCtl.queue = [
      [{ name: "Cardiology" }],
      [{ firstName: "Chidi", lastName: "Eze" }],
    ];
    const res = await callJson(postPatient, {
      url: "http://localhost:3000/api/patients",
      method: "POST",
      body: { ...VALID_BODY, attendingDoctor: "Dr. Michael Chen" },
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as {
      details?: Record<string, string[] | undefined>;
    };
    expect(body.details?.attendingDoctor).toEqual([
      "Attending doctor does not exist",
    ]);
    expect(dbCtl.insertValues).toHaveLength(0);
    expect(businessIdMock).not.toHaveBeenCalled();
  });

  it("returns 401 without a session", async () => {
    const res = await callJson(postPatient, {
      url: "http://localhost:3000/api/patients",
      method: "POST",
      body: VALID_BODY,
      session: null,
    });
    expect(res.status).toBe(401);
    expect(dbCtl.insertValues).toHaveLength(0);
  });
});

describe("PUT /api/patients/[id] rejects direct status changes (Phase 21)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbCtl.selectRows = [];
    dbCtl.insertValues = [];
    dbCtl.updateValues = [];
    dbCtl.insertRow = null;
    dbCtl.updateRow = {
      id: PATIENT_ID,
      patientId: "PT-100001",
      status: "Active",
      updatedAt: new Date().toISOString(),
    };
  });

  it("returns 400 when the body carries a status and performs no update", async () => {
    const res = await callJson(putPatient, {
      url: `http://localhost:3000/api/patients/${PATIENT_ID}`,
      method: "PUT",
      body: { status: "Discharged" },
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toMatch(/admission\/discharge/i);
    expect(dbCtl.updateValues).toHaveLength(0);
  });

  it("applies allowed fields while status is absent from the update", async () => {
    const res = await callJson(putPatient, {
      url: `http://localhost:3000/api/patients/${PATIENT_ID}`,
      method: "PUT",
      body: { phone: "555-0100" },
    });
    expect(res.status).toBe(200);
    expect(dbCtl.updateValues).toHaveLength(1);
    const values = dbCtl.updateValues[0] as Record<string, unknown>;
    expect(values.phone).toBe("555-0100");
    expect("status" in values).toBe(false);
  });

  it("returns 403 for a role without patients:write", async () => {
    const res = await callJson(putPatient, {
      url: `http://localhost:3000/api/patients/${PATIENT_ID}`,
      method: "PUT",
      body: { phone: "555-0100" },
      session: session("PHARMACIST"),
    });
    expect(res.status).toBe(403);
    expect(dbCtl.updateValues).toHaveLength(0);
  });
});
