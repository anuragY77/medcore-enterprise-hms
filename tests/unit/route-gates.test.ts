// Phase 27: write-gate contract tests for clinical workflow routes.
//
// No committed tests covered the 401/403 contracts of the discharge,
// transfer, dispense, lab-complete, or billing routes, and the prescription
// POST was gated on patients:write, which let RECEPTIONIST (and any role
// holding patients:write) prescribe â€” contradicting the PRD's role scoping.
// The prescriptions gate is now prescriptions:write (ADMIN/DOCTOR/SURGEON).
// These tests fail if any gate is removed, widened to the wrong role, or if
// the prescriptions regression returns.
import { beforeEach, describe, expect, it, vi } from "vitest";

const dbCtl = vi.hoisted(() => ({
  selectRows: [] as unknown[],
  insertValues: [] as unknown[],
  updateValues: [] as unknown[],
  insertRow: null as unknown,
  updateRow: null as unknown,
  calls: { select: 0, insert: 0, update: 0 },
}));

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn() }));
vi.mock("@/lib/business-id", () => ({
  nextBusinessId: vi.fn(async () => "INV-900001"),
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
      select: () => {
        dbCtl.calls.select++;
        return makeChain(dbCtl.selectRows);
      },
      insert: () => {
        dbCtl.calls.insert++;
        return makeChain([dbCtl.insertRow]);
      },
      update: () => {
        dbCtl.calls.update++;
        return makeChain([dbCtl.updateRow]);
      },
    },
    patients: tableStub(),
    prescriptions: tableStub(),
    consultations: tableStub(),
    medicalRecords: tableStub(),
    beds: tableStub(),
    pharmacyMedicines: tableStub(),
    labTests: tableStub(),
    invoices: tableStub(),
    appointments: tableStub(),
  };
});

import { auth } from "@/lib/auth";
import { POST as postPrescription } from "@/app/api/patients/[id]/prescriptions/route";
import { POST as postDischarge } from "@/app/api/patients/[id]/discharge/route";
import { POST as postTransfer } from "@/app/api/patients/[id]/transfer/route";
import { POST as postDispense } from "@/app/api/pharmacy/prescriptions/[id]/dispense/route";
import { POST as postComplete } from "@/app/api/laboratory/[id]/complete/route";
import { POST as postBilling } from "@/app/api/billing/route";

const authMock = vi.mocked(auth);

const ANY_ID = "3f1d2a7c-9b64-4e21-8a5f-1c2d3e4f5a6b";

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
      id: `usr_gate_${role.toLowerCase()}`,
      name: "Gate Tester",
      email: `${role.toLowerCase()}@medcore.test`,
      role,
      department: "Administration",
    },
    sessionId: `sid-gate-${role}`,
    authAt: 1_700_000_000,
  };
}

type Handler = (
  request: import("next/server").NextRequest,
  context: { params: Promise<{ id: string }> }
) => Promise<Response>;

async function call(
  handler: Handler,
  options: {
    url: string;
    method?: "POST";
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
    method: options.method ?? "POST",
    headers: { "content-type": "application/json" },
    ...(options.body !== undefined
      ? { body: JSON.stringify(options.body), duplex: "half" as const }
      : {}),
  } as unknown as ConstructorParameters<typeof NextRequest>[1]);
  return handler(request, { params: Promise.resolve({ id: ANY_ID }) });
}

interface GateCase {
  name: string;
  handler: Handler;
  url: string;
  allowedRole: string;
  deniedRole: string;
}

const GATE_CASES: GateCase[] = [
  {
    name: "POST /api/patients/[id]/prescriptions (prescriptions:write)",
    handler: postPrescription,
    url: `http://localhost:3000/api/patients/${ANY_ID}/prescriptions`,
    allowedRole: "DOCTOR",
    deniedRole: "RECEPTIONIST",
  },
  {
    name: "POST /api/patients/[id]/discharge (patients:write)",
    handler: postDischarge,
    url: `http://localhost:3000/api/patients/${ANY_ID}/discharge`,
    allowedRole: "NURSE",
    deniedRole: "BILLING",
  },
  {
    name: "POST /api/patients/[id]/transfer (beds:write)",
    handler: postTransfer,
    url: `http://localhost:3000/api/patients/${ANY_ID}/transfer`,
    allowedRole: "ADMIN",
    deniedRole: "NURSE",
  },
  {
    name: "POST /api/pharmacy/prescriptions/[id]/dispense (pharmacy:write)",
    handler: postDispense,
    url: `http://localhost:3000/api/pharmacy/prescriptions/${ANY_ID}/dispense`,
    allowedRole: "PHARMACIST",
    deniedRole: "DOCTOR",
  },
  {
    name: "POST /api/laboratory/[id]/complete (laboratory:write)",
    handler: postComplete,
    url: `http://localhost:3000/api/laboratory/${ANY_ID}/complete`,
    allowedRole: "LAB_TECHNICIAN",
    deniedRole: "DOCTOR",
  },
  {
    name: "POST /api/billing (billing:write)",
    handler: postBilling,
    url: "http://localhost:3000/api/billing",
    allowedRole: "BILLING",
    deniedRole: "DOCTOR",
  },
];

describe("clinical workflow write gates (Phase 27)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbCtl.selectRows = [];
    dbCtl.insertValues = [];
    dbCtl.updateValues = [];
    dbCtl.insertRow = { id: "row-new" };
    dbCtl.updateRow = null;
    dbCtl.selectRows = [{ id: ANY_ID }];
    dbCtl.calls = { select: 0, insert: 0, update: 0 };
  });

  for (const gate of GATE_CASES) {
    describe(gate.name, () => {
      it("returns 401 without a session and touches no data", async () => {
        const res = await call(gate.handler, {
          url: gate.url,
          body: {},
          session: null,
        });
        expect(res.status).toBe(401);
        expect(dbCtl.calls).toEqual({ select: 0, insert: 0, update: 0 });
      });

      it(`returns 403 for a role without the gate permission (${gate.deniedRole}) and touches no data`, async () => {
        const res = await call(gate.handler, {
          url: gate.url,
          body: {},
          session: session(gate.deniedRole),
        });
        expect(res.status).toBe(403);
        const body = (await res.json()) as { error?: string };
        expect(body.error).toBe("Forbidden");
        expect(dbCtl.calls).toEqual({ select: 0, insert: 0, update: 0 });
      });

      it(`passes the gate for ${gate.allowedRole} (not 401/403)`, async () => {
        const res = await call(gate.handler, {
          url: gate.url,
          body: {},
          session: session(gate.allowedRole),
        });
        expect([401, 403]).not.toContain(res.status);
      });
    });
  }

  it("keeps prescribing out of RECEPTIONIST and NURSE (PRD role scoping)", async () => {
    for (const role of ["RECEPTIONIST", "NURSE", "PHARMACIST", "BILLING", "SECURITY"]) {
      const res = await call(postPrescription, {
        url: `http://localhost:3000/api/patients/${ANY_ID}/prescriptions`,
        body: {},
        session: session(role),
      });
      expect(res.status).toBe(403);
    }
  });

  it("grants prescribing to ADMIN, DOCTOR, and SURGEON", async () => {
    for (const role of ["ADMIN", "DOCTOR", "SURGEON"]) {
      const res = await call(postPrescription, {
        url: `http://localhost:3000/api/patients/${ANY_ID}/prescriptions`,
        body: {},
        session: session(role),
      });
      expect([401, 403]).not.toContain(res.status);
    }
  });
});
