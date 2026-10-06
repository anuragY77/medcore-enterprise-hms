// Phase 21: reports financial gate.
//
// GET /api/reports gated the whole payload on `reports:read` alone, so roles
// with reports:read but without billing:read (DOCTOR, LAB_TECHNICIAN)
// received the full financial block (invoice totals, claim amounts). The
// financial block is now gated with the same dashboardVisibility() rule the
// dashboard enforces, and the page hides the billing cards when it is null.
// These tests fail if the gate is reverted.
import { beforeEach, describe, expect, it, vi } from "vitest";

const dbCtl = vi.hoisted(() => ({
  selectRows: [] as unknown[],
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
      "values",
      "set",
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
      select: () => makeChain(dbCtl.selectRows),
      insert: () => makeChain([]),
      update: () => makeChain([]),
    },
    patients: tableStub(),
    invoices: tableStub(),
    insuranceClaims: tableStub(),
    appointments: tableStub(),
    beds: tableStub(),
    emergencyCases: tableStub(),
    surgeries: tableStub(),
  };
});

import { auth } from "@/lib/auth";
import { GET as getReports } from "@/app/api/reports/route";

const authMock = vi.mocked(auth);

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
      id: `usr_${role.toLowerCase()}`,
      name: `Test ${role}`,
      email: `${role.toLowerCase()}@medcore.test`,
      role,
      department: "Internal",
    },
    sessionId: `sid-${role.toLowerCase()}`,
    authAt: 1_700_000_000,
  };
}

type NextRequestInit = ConstructorParameters<
  typeof import("next/server").NextRequest
>[1];

async function get(url = "http://localhost:3000/api/reports"): Promise<Response> {
  const { NextRequest } = await import("next/server");
  const request = new NextRequest(url, { method: "GET" } as NextRequestInit);
  return getReports(request);
}

interface ReportsPayload {
  data?: {
    financial?: unknown;
    patients?: unknown;
    operations?: unknown;
  };
}

describe("GET /api/reports financial block is gated on billing:read (Phase 21)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbCtl.selectRows = [];
  });

  it("returns 401 without a session", async () => {
    authMock.mockResolvedValue(null);
    const res = await get();
    expect(res.status).toBe(401);
  });

  it("returns 403 for a role without reports:read", async () => {
    authMock.mockResolvedValue(session("NURSE") as Awaited<ReturnType<typeof auth>>);
    const res = await get();
    expect(res.status).toBe(403);
  });

  it("nulls the financial block for DOCTOR (reports:read, no billing:read)", async () => {
    authMock.mockResolvedValue(session("DOCTOR") as Awaited<ReturnType<typeof auth>>);
    const res = await get();
    expect(res.status).toBe(200);
    const body = (await res.json()) as ReportsPayload;
    expect(body.data?.financial).toBeNull();
    // The operational report itself is unaffected.
    expect(body.data?.patients).toBeTruthy();
    expect(body.data?.operations).toBeTruthy();
  });

  it("nulls the financial block for LAB_TECHNICIAN (reports:read, no billing:read)", async () => {
    authMock.mockResolvedValue(
      session("LAB_TECHNICIAN") as Awaited<ReturnType<typeof auth>>
    );
    const res = await get();
    expect(res.status).toBe(200);
    const body = (await res.json()) as ReportsPayload;
    expect(body.data?.financial).toBeNull();
  });

  it("returns the financial block for BILLING (reports:read + billing:read)", async () => {
    authMock.mockResolvedValue(session("BILLING") as Awaited<ReturnType<typeof auth>>);
    const res = await get();
    expect(res.status).toBe(200);
    const body = (await res.json()) as ReportsPayload;
    expect(body.data?.financial).toBeTruthy();
    expect(body.data?.financial).toMatchObject({
      totalInvoiced: 0,
      totalPaid: 0,
      invoiceCount: 0,
    });
  });

  it("returns the financial block for ADMIN (reports:read + billing:read)", async () => {
    authMock.mockResolvedValue(session("ADMIN") as Awaited<ReturnType<typeof auth>>);
    const res = await get();
    expect(res.status).toBe(200);
    const body = (await res.json()) as ReportsPayload;
    expect(body.data?.financial).toBeTruthy();
  });
});
