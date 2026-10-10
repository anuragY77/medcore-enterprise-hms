// Phase 28: discharge/transfer state-machine unit tests (PRD §9.3/§9.6).
//
// route-gates.test.ts only covers the 401/403 permission contracts of these
// routes; integration/clinical-workflows.test.ts covers the full state
// machine against real SQL but is skipped when TEST_DATABASE_URL is absent.
// This file keeps the state rules in the always-on battery: 404/409 branches
// selected before any write happens, asserted with a sequenced select queue
// (each db.select() consumes the next queued result, so multi-query routes
// can distinguish the patient lookup from the bed lookups).
import { beforeEach, describe, expect, it, vi } from "vitest";

const dbCtl = vi.hoisted(() => ({
  queue: [] as unknown[],
  insertValues: [] as unknown[],
  updateValues: [] as unknown[],
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
      "set",
      "values",
    ]) {
      chain[method] = () => chain;
    }
    chain.then = (
      onFulfilled: (value: unknown) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => Promise.resolve(result).then(onFulfilled, onRejected);
    return chain;
  };

  return {
    db: {
      select: () => makeChain(dbCtl.queue.shift() ?? []),
      insert: () => {
        const chain = makeChain([null]);
        chain.values = (values: unknown) => {
          dbCtl.insertValues.push(values);
          return chain;
        };
        return chain;
      },
      update: () => {
        const chain = makeChain([null]);
        chain.set = (values: unknown) => {
          dbCtl.updateValues.push(values);
          return chain;
        };
        return chain;
      },
      transaction: (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          select: () => makeChain(dbCtl.queue.shift() ?? []),
          insert: () => makeChain([null]),
          update: () => makeChain([null]),
        }),
    },
    patients: tableStub(),
    medicalRecords: tableStub(),
    beds: tableStub(),
    auditLogs: tableStub(),
    notifications: tableStub(),
    users: tableStub(),
    staff: tableStub(),
  };
});

import { auth } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { POST as postDischarge } from "@/app/api/patients/[id]/discharge/route";
import { POST as postTransfer } from "@/app/api/patients/[id]/transfer/route";

const authMock = vi.mocked(auth);
const auditMock = vi.mocked(recordAudit);

const PATIENT_ID = "3f1d2a7c-9b64-4e21-8a5f-1c2d3e4f5a6b";
const BED_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BED_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

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

function session(role = "ADMIN"): TestSession {
  return {
    user: {
      id: "usr_workflow_1",
      name: "Workflow Tester",
      email: "admin@medcore.test",
      role,
      department: "Administration",
    },
    sessionId: "sid-workflow",
    authAt: 1_700_000_000,
  };
}

function patientRow(status: string): Record<string, unknown> {
  return { id: PATIENT_ID, patientId: "PT-100001", status };
}

function bedRow(
  id: string,
  status: string,
  patientId: string | null
): Record<string, unknown> {
  return { id, bedId: "BED-1", status, patientId };
}

async function call(
  handler: (
    request: import("next/server").NextRequest,
    context: { params: Promise<{ id: string }> }
  ) => Promise<Response>,
  options: {
    id: string;
    body?: unknown;
    session?: TestSession | null;
  }
): Promise<Response> {
  const { NextRequest } = await import("next/server");
  authMock.mockResolvedValue(
    (options.session === undefined
      ? session()
      : options.session) as Awaited<ReturnType<typeof auth>>
  );
  const request = new NextRequest(
    `http://localhost:3000/api/patients/${options.id}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      ...(options.body !== undefined
        ? { body: JSON.stringify(options.body), duplex: "half" as const }
        : {}),
    } as ConstructorParameters<typeof import("next/server").NextRequest>[1]
  );
  return handler(request, { params: Promise.resolve({ id: options.id }) });
}

const DISCHARGE_BODY = {
  diagnosis: "Recovered",
  treatmentSummary: "Full course completed",
};

beforeEach(() => {
  vi.clearAllMocks();
  dbCtl.queue = [];
  dbCtl.insertValues = [];
  dbCtl.updateValues = [];
});

describe("discharge state rules (unit)", () => {
  it("rejects a non-uuid id with 400 without touching the database", async () => {
    const res = await call(postDischarge, {
      id: "not-a-uuid",
      body: DISCHARGE_BODY,
    });
    expect(res.status).toBe(400);
    expect(dbCtl.queue).toHaveLength(0);
    expect(auditMock).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown patient", async () => {
    dbCtl.queue = [[]];
    const res = await call(postDischarge, {
      id: PATIENT_ID,
      body: DISCHARGE_BODY,
    });
    expect(res.status).toBe(404);
    expect(dbCtl.insertValues).toHaveLength(0);
    expect(auditMock).not.toHaveBeenCalled();
  });

  it("returns 409 for an already discharged patient and records no audit", async () => {
    dbCtl.queue = [[patientRow("Discharged")]];
    const res = await call(postDischarge, {
      id: PATIENT_ID,
      body: DISCHARGE_BODY,
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe("Patient is not currently admitted");
    expect(dbCtl.updateValues).toHaveLength(0);
    expect(auditMock).not.toHaveBeenCalled();
  });
});

describe("transfer state rules (unit)", () => {
  it("rejects a non-uuid id with 400 without touching the database", async () => {
    const res = await call(postTransfer, {
      id: "not-a-uuid",
      body: { bedId: BED_A },
    });
    expect(res.status).toBe(400);
    expect(dbCtl.queue).toHaveLength(0);
    expect(auditMock).not.toHaveBeenCalled();
  });

  it("rejects a non-uuid destination with 400", async () => {
    const res = await call(postTransfer, {
      id: PATIENT_ID,
      body: { bedId: "nope" },
    });
    expect(res.status).toBe(400);
    expect(dbCtl.queue).toHaveLength(0);
  });

  it("returns 404 for an unknown patient", async () => {
    dbCtl.queue = [[]];
    const res = await call(postTransfer, {
      id: PATIENT_ID,
      body: { bedId: BED_A },
    });
    expect(res.status).toBe(404);
    expect(dbCtl.updateValues).toHaveLength(0);
    expect(auditMock).not.toHaveBeenCalled();
  });

  it("returns 409 for a discharged patient", async () => {
    dbCtl.queue = [[patientRow("Discharged")]];
    const res = await call(postTransfer, {
      id: PATIENT_ID,
      body: { bedId: BED_A },
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe("Patient has been discharged");
    expect(auditMock).not.toHaveBeenCalled();
  });

  it("returns 409 when the patient occupies no bed", async () => {
    dbCtl.queue = [[patientRow("Active")], []];
    const res = await call(postTransfer, {
      id: PATIENT_ID,
      body: { bedId: BED_A },
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe("Patient does not occupy a bed");
    expect(auditMock).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown destination bed", async () => {
    dbCtl.queue = [[patientRow("Active")], [bedRow(BED_A, "Occupied", PATIENT_ID)], []];
    const res = await call(postTransfer, {
      id: PATIENT_ID,
      body: { bedId: BED_B },
    });
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe("Bed not found");
    expect(dbCtl.updateValues).toHaveLength(0);
    expect(auditMock).not.toHaveBeenCalled();
  });

  it("returns 409 when the destination is the patient's own bed", async () => {
    const ownBed = bedRow(BED_A, "Occupied", PATIENT_ID);
    dbCtl.queue = [[patientRow("Active")], [ownBed], [ownBed]];
    const res = await call(postTransfer, {
      id: PATIENT_ID,
      body: { bedId: BED_A },
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe("Patient is already assigned to this bed");
    expect(dbCtl.updateValues).toHaveLength(0);
  });

  it("returns 409 when the destination bed is not available", async () => {
    dbCtl.queue = [[patientRow("Active")], [bedRow(BED_A, "Occupied", PATIENT_ID)], [bedRow(BED_B, "Occupied", "cccccccc-cccc-4ccc-8ccc-cccccccccccc")]];
    const res = await call(postTransfer, {
      id: PATIENT_ID,
      body: { bedId: BED_B },
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe("Bed is not available for assignment");
    expect(dbCtl.updateValues).toHaveLength(0);
    expect(auditMock).not.toHaveBeenCalled();
  });
});
