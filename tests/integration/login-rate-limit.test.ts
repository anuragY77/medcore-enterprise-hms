import { inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "@/lib/db/schema";
import { loginRateLimits } from "@/lib/db";
import {
  LOGIN_RATE_LIMIT_POLICY,
  buildRateLimitKeys,
  createPgRateLimitStore,
  rateLimitEntries,
  type RateLimitEntry,
  type RateLimitPolicy,
  type RateLimitStore,
} from "@/lib/login-rate-limit";
import {
  integrationEnabled,
  setupIntegration,
  teardownIntegration,
  type IntegrationContext,
} from "./helpers";

const RUN = integrationEnabled;

// Tight, test-local policy: tiny thresholds so blocking is quick, but a very
// high IP/account threshold so the three keys of different tests cannot
// interfere with each other.
const POLICY: RateLimitPolicy = {
  windowMs: 60_000,
  blockMs: 60_000,
  maxFailuresPerPair: 3,
  maxFailuresPerIp: 100,
  maxFailuresPerAccount: 100,
};

function entriesFor(ip: string, email: string): RateLimitEntry[] {
  return rateLimitEntries(buildRateLimitKeys(ip, email), POLICY);
}

describe.skipIf(!RUN)("login rate-limit store integration", () => {
  let ctx: IntegrationContext;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let store: RateLimitStore;

  beforeAll(async () => {
    ctx = await setupIntegration();
    db = drizzle(ctx.pool, { schema });
    store = createPgRateLimitStore(db, POLICY);
    await ctx.pool.query("DELETE FROM login_rate_limits");
  });
  afterAll(async () => {
    await ctx.pool.query("DELETE FROM login_rate_limits");
    await teardownIntegration(ctx);
  });

  it("blocks after the pair threshold and reports a positive retry window", async () => {
    const entries = entriesFor("198.51.100.1", "blocked@medcore.test");
    const now = new Date();

    for (let i = 0; i < POLICY.maxFailuresPerPair - 1; i++) {
      await store.recordFailures(entries, new Date(now.getTime() + i));
    }
    // One below threshold: not blocked yet.
    const almost = await store.check(entries, new Date(now.getTime() + 100));
    expect(almost.blocked).toBe(false);

    await store.recordFailures(entries, new Date(now.getTime() + 100));
    const blocked = await store.check(entries, new Date(now.getTime() + 101));
    expect(blocked.blocked).toBe(true);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
    expect(blocked.retryAfterMs).toBeLessThanOrEqual(POLICY.blockMs);

    // A different pair from the same source is untouched (key isolation).
    const other = entriesFor("198.51.100.1", "other@medcore.test");
    const otherResult = await store.check(other, new Date(now.getTime() + 101));
    expect(otherResult.blocked).toBe(false);
  });

  it("resets the failure count once the rolling window has passed", async () => {
    const entries = entriesFor("198.51.100.2", "window@medcore.test");
    const now = Date.now();

    // Age the first failure beyond the window.
    await store.recordFailures(entries, new Date(now - POLICY.windowMs - 5_000));
    // A fresh failure starts a new window at count 1, not 2.
    await store.recordFailures(entries, new Date(now));

    const rows = await db
      .select()
      .from(loginRateLimits)
      .where(
        inArray(loginRateLimits.key, entries.map((e) => e.key))
      );
    const pairRow = rows.find((r) => r.key.startsWith("pair:"));
    expect(pairRow?.failCount).toBe(1);
    expect(await store.check(entries, new Date(now))).toMatchObject({
      blocked: false,
    });
  });

  it("clears all keys for an attempt after a successful sign-in", async () => {
    const entries = entriesFor("198.51.100.3", "success@medcore.test");
    const now = new Date();
    for (let i = 0; i < POLICY.maxFailuresPerPair; i++) {
      await store.recordFailures(entries, new Date(now.getTime() + i));
    }
    expect((await store.check(entries, new Date(now))).blocked).toBe(true);

    const keys = buildRateLimitKeys("198.51.100.3", "success@medcore.test");
    await store.clear(Object.values(keys));

    expect((await store.check(entries, new Date(now))).blocked).toBe(false);
    const remaining = await db
      .select()
      .from(loginRateLimits)
      .where(inArray(loginRateLimits.key, Object.values(keys)));
    expect(remaining).toHaveLength(0);
  });

  it("prunes rows idle for longer than the retention period", async () => {
    const entries = entriesFor("198.51.100.4", "stale@medcore.test");
    // Write a row dated two days in the past (outside 24h retention)...
    await store.recordFailures(
      entries,
      new Date(Date.now() - 48 * 60 * 60_000)
    );
    // ...then any newer write from this store must sweep it away.
    await store.recordFailures(
      entriesFor("198.51.100.5", "fresh@medcore.test"),
      new Date()
    );

    const stale = await db
      .select()
      .from(loginRateLimits)
      .where(inArray(loginRateLimits.key, entries.map((e) => e.key)));
    expect(stale).toHaveLength(0);
  });

  it("counts concurrent failures without losing increments", async () => {
    // Phase 18: recordFailures upserts atomically (failCount + 1 in SQL), so
    // N simultaneous failed logins must land exactly N increments — a lost
    // update here would silently raise the effective threshold.
    const entries = entriesFor("198.51.100.8", "concurrent@medcore.test");
    const now = new Date();
    await Promise.all(
      Array.from({ length: 10 }, () => store.recordFailures(entries, now))
    );
    const rows = await db
      .select()
      .from(loginRateLimits)
      .where(
        inArray(loginRateLimits.key, entries.map((e) => e.key))
      );
    const pairRow = rows.find((r) => r.key.startsWith("pair:"));
    expect(pairRow?.failCount).toBe(10);
    // Ten failures are beyond the pair threshold -> blocked.
    expect((await store.check(entries, now)).blocked).toBe(true);
    await store.clear(entries.map((e) => e.key));
  });

  it("releases the block once the cooldown window has elapsed", async () => {
    const entries = entriesFor("198.51.100.9", "cooldown@medcore.test");
    const now = new Date();
    for (let i = 0; i < POLICY.maxFailuresPerPair; i++) {
      await store.recordFailures(entries, new Date(now.getTime() + i));
    }
    expect((await store.check(entries, now)).blocked).toBe(true);
    // Past blocked_until the same attempt is allowed again — blocks are
    // temporary (never a permanent lockout).
    const after = await store.check(
      entries,
      new Date(now.getTime() + POLICY.blockMs + 1_000)
    );
    expect(after.blocked).toBe(false);
    await store.clear(entries.map((e) => e.key));
  });

  it("fails open: a broken store never blocks, throws, or counts", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      // A pool that was never connected to a reachable server.
      const { Pool } = await import("pg");
      const deadPool = new Pool({
        connectionString:
          "postgresql://closed:closed@127.0.0.1:1/never_connected",
        connectionTimeoutMillis: 200,
      });
      const deadStore = createPgRateLimitStore(drizzle(deadPool, { schema }), POLICY);
      const entries = entriesFor("198.51.100.6", "outage@medcore.test");

      await expect(deadStore.check(entries, new Date())).resolves.toEqual({
        blocked: false,
        retryAfterMs: 0,
      });
      await expect(
        deadStore.recordFailures(entries, new Date())
      ).resolves.toBeUndefined();
      await expect(deadStore.clear(entries.map((e) => e.key))).resolves.toBeUndefined();

      expect(errorSpy).toHaveBeenCalled();
      await deadPool.end();
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("records sibling entries even when one key exceeds storage bounds", async () => {
    // Phase 18 regression: login_rate_limits.key is varchar(200). An
    // attacker-controlled oversized key (unbounded email or forwarded IP)
    // must not abort recording of the remaining keys — otherwise a single
    // malformed attempt silently disables counting for that request.
    const now = new Date();
    const oversized: RateLimitEntry[] = [
      { key: `pair:${"9".repeat(300)}|victim@medcore.test`, threshold: 5 },
      { key: "ip:198.51.100.7", threshold: 20 },
      { key: "acct:victim@medcore.test", threshold: 30 },
    ];
    await store.recordFailures(oversized, now);
    const rows = await db
      .select({ key: loginRateLimits.key })
      .from(loginRateLimits)
      .where(
        inArray(loginRateLimits.key, [
          "ip:198.51.100.7",
          "acct:victim@medcore.test",
        ])
      );
    expect(rows).toHaveLength(2);
    await store.clear(["ip:198.51.100.7", "acct:victim@medcore.test"]);
  });

  it("keeps LOGIN_RATE_LIMIT_POLICY block windows temporary and bounded", () => {
    expect(LOGIN_RATE_LIMIT_POLICY.blockMs).toBeGreaterThan(0);
    expect(LOGIN_RATE_LIMIT_POLICY.blockMs).toBeLessThanOrEqual(60 * 60_000);
    expect(LOGIN_RATE_LIMIT_POLICY.windowMs).toBeGreaterThan(0);
  });
});

