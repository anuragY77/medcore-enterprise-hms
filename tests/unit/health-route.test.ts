// Phase 32: GET /api/health — minimal operational probe.
//
// Contract: liveness is always HTTP 200 while the process serves; readiness
// is the `checks.database` field ("ok" only when SELECT 1 round-trips). The
// response must never contain connection strings, secrets, or stack traces.
// The auditWriteFailures counter is visible only to audit:read sessions
// (SECURITY/ADMIN), and it reflects the live in-process counter.
import { beforeEach, describe, expect, it, vi } from "vitest";

const dbCtl = vi.hoisted(() => ({
  executeError: null as Error | null,
  executeCalls: 0,
}));

const authCtl = vi.hoisted(() => ({
  session: null as unknown,
}));

vi.mock("@/lib/db", () => ({
  db: {
    execute: () => {
      dbCtl.executeCalls += 1;
      if (dbCtl.executeError) {
        return Promise.reject(dbCtl.executeError);
      }
      return Promise.resolve({ rows: [{ "?column?": 1 }] });
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => authCtl.session),
}));

import { GET } from "@/app/api/health/route";
import { auth } from "@/lib/auth";

function session(role: string, id = "user-1") {
  return {
    user: {
      id,
      name: "Health Tester",
      email: "health@medcore.test",
      role,
      department: "Administration",
    },
    sessionId: "sid-health",
    authAt: 1_700_000_000,
  };
}

beforeEach(() => {
  dbCtl.executeError = null;
  dbCtl.executeCalls = 0;
  authCtl.session = null;
  vi.mocked(auth).mockClear();
});

describe("GET /api/health", () => {
  it("returns liveness 200 with database ok and no secrets for anonymous callers", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "ok", checks: { database: "ok" } });
    expect(body).not.toHaveProperty("auditWriteFailures");
    expect(res.headers.get("cache-control")).toBe("no-store");
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("postgresql");
    expect(serialized).not.toContain("AUTH_SECRET");
  });

  it("reports database down (readiness signal) when SELECT 1 fails, still liveness 200", async () => {
    dbCtl.executeError = new Error("connection refused");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.checks.database).toBe("down");
    // The driver error must not leak to the client.
    expect(JSON.stringify(body)).not.toContain("connection refused");
  });

  it("exposes auditWriteFailures only to audit:read sessions (SECURITY/ADMIN)", async () => {
    authCtl.session = session("SECURITY");
    const res = await GET();
    const body = await res.json();
    expect(body.auditWriteFailures).toBe(0);

    authCtl.session = session("ADMIN");
    const resAdmin = await GET();
    const bodyAdmin = await resAdmin.json();
    expect(bodyAdmin.auditWriteFailures).toBe(0);

    authCtl.session = session("DOCTOR");
    const res2 = await GET();
    const body2 = await res2.json();
    expect(body2).not.toHaveProperty("auditWriteFailures");
  });

  it("treats an auth() rejection as anonymous (probe must not 500)", async () => {
    vi.mocked(auth).mockRejectedValueOnce(new Error("auth store down"));
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.checks.database).toBe("ok");
  });

  it("exposes the live audit-failure counter (not a constant)", async () => {
    const { resetAuditFailureCountForTests, recordAudit } = await import(
      "@/lib/audit"
    );
    resetAuditFailureCountForTests();
    // The mocked db has no insert(), so this best-effort write fails and
    // increments the in-process counter — the exact signal the endpoint
    // reports. (In production the same increment happens when a real
    // insert throws; transactional paths never touch this counter.)
    await recordAudit({
      actorId: "user-1",
      action: "unit.counter.probe",
    });

    authCtl.session = session("ADMIN");
    const res = await GET();
    const body = await res.json();
    expect(body.auditWriteFailures).toBe(1);

    // Reset so later test runs see a clean counter (module state is shared).
    resetAuditFailureCountForTests();
  });
});
