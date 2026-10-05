// Phase 19: unit tests for the central liveness gate â€” the single decision
// point used by the auth() wrapper, the middleware wrapper, and the
// session-endpoint guard. Store, audit and clock inputs are injected so
// every branch (active / idle-expired / invalid / store failure) is
// observable without a database.
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { Session } from "next-auth";
import { enforceSessionLiveness } from "@/lib/session-liveness";
import type { SessionLivenessDeps } from "@/lib/session-liveness";
import { SESSION_IDLE_TIMEOUT_SECONDS } from "@/lib/session-config";

interface TestDeps extends SessionLivenessDeps {
  check: Mock;
  markExpired: Mock;
  audit: Mock;
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    user: {
      id: "usr-1",
      name: "Nurse Emily",
      email: "nurse@medcore.com",
      role: "NURSE",
      department: "Emergency",
    },
    expires: new Date(Date.now() + 3600_000).toISOString(),
    sessionId: "sid-1",
    authAt: Math.floor(Date.now() / 1000) - 60,
    idleTimeoutSeconds: SESSION_IDLE_TIMEOUT_SECONDS,
    ...overrides,
  } as Session;
}

function baseDeps(overrides: Partial<SessionLivenessDeps> = {}): TestDeps {
  return {
    check: vi.fn(async () => ({ kind: "active", role: "NURSE" }) as const),
    markExpired: vi.fn(async () => true),
    audit: vi.fn(async () => undefined),
    ...overrides,
  } as TestDeps;
}

describe("enforceSessionLiveness", () => {
  let errorSpy: Mock;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null for a missing session without consulting the store", async () => {
    const deps = baseDeps();
    expect(await enforceSessionLiveness(null, deps)).toBeNull();
    expect(await enforceSessionLiveness(undefined, deps)).toBeNull();
    expect(deps.check).not.toHaveBeenCalled();
  });

  it("returns null for a session without a sid (no shared state to check)", async () => {
    const deps = baseDeps();
    const session = makeSession();
    delete (session as { sessionId?: string }).sessionId;
    expect(await enforceSessionLiveness(session, deps)).toBeNull();
    expect(deps.check).not.toHaveBeenCalled();
  });

  it("passes the session's identifiers and the configured idle window to the store", async () => {
    const deps = baseDeps();
    const session = makeSession({ authAt: 1_700_000_000 } as Partial<Session>);
    await enforceSessionLiveness(session, deps);
    expect(deps.check).toHaveBeenCalledWith({
      sid: "sid-1",
      userId: "usr-1",
      authAt: 1_700_000_000,
      idleSeconds: SESSION_IDLE_TIMEOUT_SECONDS,
    });
  });

  it("treats a missing authAt as epoch zero (seeds expired â€” never a grace window)", async () => {
    const deps = baseDeps();
    const session = makeSession();
    delete (session as { authAt?: number }).authAt;
    await enforceSessionLiveness(session, deps);
    expect(deps.check.mock.calls[0][0].authAt).toBe(0);
  });

  it("returns the session unchanged when activity is within the window", async () => {
    const deps = baseDeps();
    const session = makeSession();
    const result = await enforceSessionLiveness(session, deps);
    expect(result).toBe(session);
    expect(result?.user.role).toBe("NURSE");
    expect(deps.markExpired).not.toHaveBeenCalled();
    expect(deps.audit).not.toHaveBeenCalled();
  });

  it("refreshes the role from the database when it changed (privilege rotation)", async () => {
    const deps = baseDeps({
      check: vi.fn(async () => ({ kind: "active", role: "DOCTOR" }) as const),
    });
    const session = makeSession();
    const result = await enforceSessionLiveness(session, deps);
    expect(result).not.toBeNull();
    expect(result?.user.role).toBe("DOCTOR");
    expect(deps.audit).not.toHaveBeenCalled();
  });

  it("rejects an idle-expired session, flags it once, and audits that first observation", async () => {
    const deps = baseDeps({
      check: vi.fn(async () => ({ kind: "idle_expired" }) as const),
      markExpired: vi.fn(async () => true),
    });
    const session = makeSession();
    expect(await enforceSessionLiveness(session, deps)).toBeNull();
    expect(deps.markExpired).toHaveBeenCalledWith("sid-1");
    expect(deps.audit).toHaveBeenCalledTimes(1);
    expect(deps.audit.mock.calls[0][0]).toMatchObject({
      actorId: "usr-1",
      action: "auth.session_idle_expired",
      category: "auth",
      success: false,
    });
  });

  it("does not re-audit an expiry that was already logged", async () => {
    const deps = baseDeps({
      check: vi.fn(async () => ({ kind: "idle_expired" }) as const),
      markExpired: vi.fn(async () => false), // flag already set
    });
    expect(await enforceSessionLiveness(makeSession(), deps)).toBeNull();
    expect(deps.audit).not.toHaveBeenCalled();
  });

  it("rejects an invalid session (deleted user / foreign sid) without auditing", async () => {
    const deps = baseDeps({
      check: vi.fn(async () => ({ kind: "invalid" }) as const),
    });
    expect(await enforceSessionLiveness(makeSession(), deps)).toBeNull();
    expect(deps.markExpired).not.toHaveBeenCalled();
    expect(deps.audit).not.toHaveBeenCalled();
  });

  it("fails closed on a transient store outage, logging the policy", async () => {
    const deps = baseDeps({
      check: vi.fn(async () => {
        throw Object.assign(new Error("connection refused"), {
          code: "ECONNREFUSED",
        });
      }),
    });
    expect(await enforceSessionLiveness(makeSession(), deps)).toBeNull();
    const message = errorSpy.mock.calls[0][0] as string;
    expect(message).toContain("database unavailable");
    expect(message).toContain("failing closed");
  });

  it("fails closed on an unexpected store defect, logging it distinctly", async () => {
    const deps = baseDeps({
      check: vi.fn(async () => {
        throw Object.assign(new Error("duplicate key value"), {
          code: "23505",
        });
      }),
    });
    expect(await enforceSessionLiveness(makeSession(), deps)).toBeNull();
    const message = errorSpy.mock.calls[0][0] as string;
    expect(message).toContain("possible defect");
    expect(message).toContain("failing closed");
  });

  it("still rejects (fails closed) when the expiry flag write blows up", async () => {
    const deps = baseDeps({
      check: vi.fn(async () => ({ kind: "idle_expired" }) as const),
      markExpired: vi.fn(async () => {
        throw new Error("store gone");
      }),
    });
    expect(await enforceSessionLiveness(makeSession(), deps)).toBeNull();
    // The failure is logged, but the session is rejected regardless.
    expect(
      (errorSpy.mock.calls[0][0] as string).includes("failing closed")
    ).toBe(true);
  });
});
