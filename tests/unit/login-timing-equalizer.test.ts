// Phase 25 §13: credential-timing equalizer regression tests.
//
// Reproduced live before the fix (phase25-timing probe, N=15 per group):
//   known email + wrong password -> median 140.8ms (full bcrypt compare)
//   unknown email + wrong password -> median 12.7ms (early return, NO bcrypt)
//   ratio 11.08x, identical 302 responses => unauthenticated account
//   enumeration by latency alone.
//
// The fix: authorize (verifyCredentials) pays exactly ONE bcrypt verify for
// every non-empty attempt — real accounts against their stored hash,
// unknown accounts against a decoy hashed with BCRYPT_COST.
//
// FAIL-ON-REVERT: removing the decoy compare (or changing its cost) makes
// these tests fail: call-count parity and cost parity are asserted directly.
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.AUTH_SECRET ??= "unit-test-only-secret";
});

const dbCtl = vi.hoisted(() => ({
  users: [] as Array<{
    id: string;
    email: string;
    password: string;
    role: string;
    name: string;
    department: string;
    avatar?: string | null;
  }>,
}));

const bcryptCtl = vi.hoisted(() => ({
  compares: [] as Array<{ password: string; hash: string }>,
  hashSyncCalls: [] as Array<{ value: string; cost: number }>,
  decoyHash: "",
  decoyCost: 0,
}));

vi.mock("bcryptjs", () => {
  // bcryptjs is CJS: default-import consumers see this object as `bcrypt`.
  return {
    __esModule: true,
    default: {
      hashSync: (value: string, cost: number) => {
        bcryptCtl.hashSyncCalls.push({ value, cost });
        bcryptCtl.decoyCost = cost;
        // Shape mirrors a real bcrypt hash at the REQUESTED cost, so any
        // cost-parity assertion tests the code, not this fixture.
        bcryptCtl.decoyHash = `$2b$${cost}$Phase25DecoyPhase25DecoyPhase25DecoyPhase2`;
        return bcryptCtl.decoyHash;
      },
      hash: async (value: string, cost: number) => `$2b$${cost}$mockedhash`,
      compare: async (password: string, hash: string) => {
        bcryptCtl.compares.push({ password, hash });
        // Decoy never verifies; the stored-hash path verifies only the
        // sentinel password so the success branch stays testable.
        if (hash === bcryptCtl.decoyHash) return false;
        return password === "correct-horse";
      },
    },
  };
});

vi.mock("@/lib/db", async () => {
  const schema = await import("@/lib/db/schema");
  return {
    db: {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => dbCtl.users.slice(0, 1)),
          })),
        })),
      })),
    },
    users: schema.users,
    auditLogs: schema.auditLogs,
    sessionActivity: schema.sessionActivity,
    loginRateLimits: schema.loginRateLimits,
  };
});

vi.mock("@/lib/audit", () => ({
  recordAudit: vi.fn(async () => undefined),
}));

vi.mock("@/lib/session-activity", () => ({
  checkSessionActivity: vi.fn(async () => ({ kind: "active", role: "ADMIN" })),
  markSessionExpiredLogged: vi.fn(async () => false),
  recordSessionActivity: vi.fn(async () => undefined),
  tombstoneSessionActivity: vi.fn(async () => undefined),
  sweepStaleSessionActivity: vi.fn(async () => undefined),
  logSessionActivityFailure: vi.fn(),
}));

import { verifyCredentials } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import {
  sweepStaleSessionActivity,
  logSessionActivityFailure,
} from "@/lib/session-activity";
import { BCRYPT_COST } from "@/lib/password";

const KNOWN_USER = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "admin@medcore.com",
  password: "$2b$10$storedhashstoredhashstoredhashstoredhashstoredhas",
  role: "ADMIN",
  name: "Anurag Yadav",
  department: "Administration",
};

let consoleErrorSpy: { mockRestore(): void } | undefined;

beforeEach(() => {
  bcryptCtl.compares = [];
  bcryptCtl.hashSyncCalls = [];
  dbCtl.users = [];
  vi.mocked(recordAudit).mockClear();
  vi.mocked(sweepStaleSessionActivity).mockClear();
  vi.mocked(logSessionActivityFailure).mockClear();
  consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterAll(() => {
  consoleErrorSpy?.mockRestore();
});

describe("credential timing equalizer (Phase 25 §13)", () => {
  it("unknown email: null after EXACTLY one bcrypt verify against the decoy", async () => {
    dbCtl.users = [];
    const result = await verifyCredentials({
      email: "ghost@nobody.invalid",
      password: "whatever",
    });
    expect(result).toBeNull();
    expect(bcryptCtl.compares).toHaveLength(1);
    expect(bcryptCtl.compares[0].password).toBe("whatever");
    expect(bcryptCtl.compares[0].hash).toBe(bcryptCtl.decoyHash);
    expect(bcryptCtl.compares[0].hash).toMatch(
      new RegExp(`^\\$2[aby]\\$${BCRYPT_COST}\\$`)
    );
    expect(bcryptCtl.hashSyncCalls).toHaveLength(1);
    expect(bcryptCtl.hashSyncCalls[0].cost).toBe(BCRYPT_COST);
    expect(recordAudit).not.toHaveBeenCalled();
  });

  it("known email + wrong password: null after exactly one bcrypt verify against the STORED hash", async () => {
    dbCtl.users = [KNOWN_USER];
    const result = await verifyCredentials({
      email: KNOWN_USER.email,
      password: "wrong-password",
    });
    expect(result).toBeNull();
    expect(bcryptCtl.compares).toHaveLength(1);
    expect(bcryptCtl.compares[0].hash).toBe(KNOWN_USER.password);
    expect(recordAudit).toHaveBeenCalledTimes(1);
  });

  it("FAIL-ON-REVERT: unknown and known/wrong attempts pay the SAME number of bcrypt verifies", async () => {
    dbCtl.users = [];
    await verifyCredentials({ email: "a@b.invalid", password: "x" });
    const unknownCount = bcryptCtl.compares.length;

    dbCtl.users = [KNOWN_USER];
    await verifyCredentials({ email: KNOWN_USER.email, password: "x" });
    const knownCount = bcryptCtl.compares.length - unknownCount;

    expect(unknownCount).toBe(1);
    expect(knownCount).toBe(1);
    expect(unknownCount).toBe(knownCount);
  });

  it("FAIL-ON-REVERT: decoy cost parity — decoy hash built with BCRYPT_COST", async () => {
    dbCtl.users = [];
    await verifyCredentials({ email: "a@b.invalid", password: "x" });
    // The decoy is hashed once per process and cached (lazy init), so the
    // recorded cost persists across tests even when hashSync is not called
    // again in this one.
    expect(bcryptCtl.decoyCost).toBe(BCRYPT_COST);
    expect(bcryptCtl.compares[0].hash).toMatch(
      new RegExp(`^\\$2[aby]\\$${BCRYPT_COST}\\$`)
    );
  });

  it("empty password short-circuits BEFORE any bcrypt verify (same cost for every email)", async () => {
    dbCtl.users = [KNOWN_USER];
    const result = await verifyCredentials({
      email: KNOWN_USER.email,
      password: "",
    });
    expect(result).toBeNull();
    expect(bcryptCtl.compares).toHaveLength(0);
  });

  it("missing credentials short-circuit before any bcrypt verify", async () => {
    const result = await verifyCredentials(undefined);
    expect(result).toBeNull();
    expect(bcryptCtl.compares).toHaveLength(0);
  });

  it("known email + correct password returns the user and audits success", async () => {
    dbCtl.users = [KNOWN_USER];
    const result = await verifyCredentials({
      email: KNOWN_USER.email,
      password: "correct-horse",
    });
    expect(result).toMatchObject({
      id: KNOWN_USER.id,
      email: KNOWN_USER.email,
      name: KNOWN_USER.name,
      role: KNOWN_USER.role,
      department: KNOWN_USER.department,
    });
    expect(bcryptCtl.compares).toHaveLength(1);
    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "auth.login", success: true })
    );
    expect(sweepStaleSessionActivity).toHaveBeenCalledTimes(1);
  });

  it("invalid stored role fails closed with an audit event", async () => {
    dbCtl.users = [{ ...KNOWN_USER, role: "NOT_A_ROLE" }];
    const result = await verifyCredentials({
      email: KNOWN_USER.email,
      password: "correct-horse",
    });
    expect(result).toBeNull();
    expect(bcryptCtl.compares).toHaveLength(0);
    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, metadata: { reason: "invalid_role" } })
    );
  });

  it("a sweep failure never blocks a successful sign-in", async () => {
    dbCtl.users = [KNOWN_USER];
    vi.mocked(sweepStaleSessionActivity).mockRejectedValueOnce(
      new Error("store down")
    );
    const result = await verifyCredentials({
      email: KNOWN_USER.email,
      password: "correct-horse",
    });
    expect(result).not.toBeNull();
    expect(logSessionActivityFailure).toHaveBeenCalledWith(
      "sweep-on-login",
      expect.any(Error)
    );
  });
});
