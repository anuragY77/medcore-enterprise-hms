// Phase 28: GET /api/reference contract (authoritative patient-form options).
//
// The patient registration form's hard-coded dropdowns offered departments
// that do not exist in this hospital; this endpoint is the only sanctioned
// source. These tests pin the gate (401 anon, 403 without patients:write) and
// the response shape (names only, doctors rendered in the seed's
// `Dr. First Last` convention).
import { beforeEach, describe, expect, it, vi } from "vitest";

const dbCtl = vi.hoisted(() => ({
  queue: [] as unknown[],
}));

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

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
    for (const method of ["from", "where", "orderBy", "limit", "groupBy", "for"]) {
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
      // loadReferenceOptions issues the departments select first, then the
      // staff select (both started synchronously inside Promise.all).
      select: () => makeChain(dbCtl.queue.shift() ?? []),
    },
    departments: tableStub(),
    staff: tableStub(),
    patients: tableStub(),
    medicalRecords: tableStub(),
    beds: tableStub(),
    auditLogs: tableStub(),
    notifications: tableStub(),
    users: tableStub(),
  };
});

import { auth } from "@/lib/auth";
import { GET as getReference } from "@/app/api/reference/route";

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
      id: "usr_ref_1",
      name: "Reference Tester",
      email: "tester@medcore.test",
      role,
      department: "Administration",
    },
    sessionId: "sid-ref",
    authAt: 1_700_000_000,
  };
}

async function call(sessionValue: TestSession | null): Promise<Response> {
  authMock.mockResolvedValue(
    sessionValue as unknown as Awaited<ReturnType<typeof auth>>
  );
  return getReference();
}

beforeEach(() => {
  vi.clearAllMocks();
  dbCtl.queue = [];
});

describe("GET /api/reference", () => {
  it("returns 401 without a session and queries no data", async () => {
    const res = await call(null);
    expect(res.status).toBe(401);
    expect(dbCtl.queue).toHaveLength(0);
  });

  it("returns 403 for a role without patients:write", async () => {
    const res = await call(session("LAB_TECHNICIAN"));
    expect(res.status).toBe(403);
    expect(dbCtl.queue).toHaveLength(0);
  });

  it("returns active departments and doctors as display names for a creator role", async () => {
    dbCtl.queue = [
      [{ name: "Cardiology" }, { name: "General Medicine" }],
      [
        { firstName: "Arjun", lastName: "Mehta" },
        { firstName: "Priya", lastName: "Sharma" },
      ],
    ];
    const res = await call(session("RECEPTIONIST"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      departments: string[];
      doctors: string[];
    };
    expect(body.departments).toEqual(["Cardiology", "General Medicine"]);
    expect(body.doctors).toEqual(["Dr. Arjun Mehta", "Dr. Priya Sharma"]);
  });

  it("returns empty lists when the reference tables are empty", async () => {
    dbCtl.queue = [[], []];
    const res = await call(session("NURSE"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      departments: string[];
      doctors: string[];
    };
    expect(body.departments).toEqual([]);
    expect(body.doctors).toEqual([]);
  });
});
