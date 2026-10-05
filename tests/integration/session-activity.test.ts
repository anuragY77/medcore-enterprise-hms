// Phase 19: PostgreSQL-backed session activity store for the server-side
// idle timeout. Every time comparison runs in the database (now() vs
// last_activity), so these tests manipulate timestamps with SQL — never
// with JavaScript Date math — mirroring production and avoiding the naive-
// timestamp skew class found in Phase 18.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@/lib/db/schema";
import {
  checkSessionActivity,
  markSessionExpiredLogged,
  recordSessionActivity,
  sweepStaleSessionActivity,
  tombstoneSessionActivity,
} from "@/lib/session-activity";
import { SESSION_ACTIVITY_RETENTION_HOURS } from "@/lib/session-config";
import {
  integrationEnabled,
  setupIntegration,
  teardownIntegration,
  type IntegrationContext,
} from "./helpers";

const RUN = integrationEnabled;
const IDLE = 900; // test-local idle window (seconds)

describe.skipIf(!RUN)("session activity store integration", () => {
  let ctx: IntegrationContext;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let userId: string;

  beforeAll(async () => {
    ctx = await setupIntegration();
    db = drizzle(ctx.pool, { schema });
    const { rows } = await ctx.pool.query(
      `INSERT INTO users (email, password, name, role, department)
       VALUES ($1, 'x', 'Session Activity Test', 'NURSE', 'Emergency')
       RETURNING id`,
      [`session-activity-${Date.now()}@medcore.test`]
    );
    userId = rows[0].id as string;
  });

  afterAll(async () => {
    // Deleting the user cascades every session_activity row for it.
    if (ctx) {
      await ctx.pool.query("DELETE FROM users WHERE id = $1", [userId]);
    }
    await teardownIntegration(ctx);
  });

  async function activityRow(sid: string) {
    const { rows } = await ctx.pool.query(
      "SELECT last_activity, expired_logged FROM session_activity WHERE sid = $1",
      [sid]
    );
    return rows[0] as
      | { last_activity: Date; expired_logged: boolean }
      | undefined;
  }

  function uniqueSid(label: string): string {
    return `sa-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  it("seeds a missing row from the token sign-in time and finds it active", async () => {
    const sid = uniqueSid("fresh-seed");
    const now = Math.floor(Date.now() / 1000);
    const result = await checkSessionActivity(
      { sid, userId, authAt: now, idleSeconds: IDLE },
      db
    );
    expect(result).toEqual({ kind: "active", role: "NURSE" });
    // The row now exists, so subsequent checks never need to re-seed.
    expect(await activityRow(sid)).toBeDefined();
  });

  it("seeds from sign-in time without granting a fresh idle window", async () => {
    const sid = uniqueSid("stale-seed");
    const now = Math.floor(Date.now() / 1000);
    // Signed in longer ago than the idle window, never recorded activity:
    // the seed must make the session already expired (no grace window).
    const result = await checkSessionActivity(
      { sid, userId, authAt: now - IDLE - 60, idleSeconds: IDLE },
      db
    );
    expect(result).toEqual({ kind: "idle_expired" });
    expect(await activityRow(sid)).toBeDefined();
  });

  it("records activity for a session with no row yet and check sees it", async () => {
    const sid = uniqueSid("record-new");
    await recordSessionActivity({ sid, userId }, db);
    const result = await checkSessionActivity(
      { sid, userId, authAt: 0, idleSeconds: IDLE },
      db
    );
    expect(result).toEqual({ kind: "active", role: "NURSE" });
  });

  it("throttles writes: a second record inside the window does not touch last_activity", async () => {
    const sid = uniqueSid("throttle");
    await recordSessionActivity({ sid, userId }, db);
    await ctx.pool.query(
      "UPDATE session_activity SET last_activity = now() - interval '10 seconds' WHERE sid = $1",
      [sid]
    );
    await recordSessionActivity({ sid, userId }, db);
    const row = await activityRow(sid);
    expect(row).toBeDefined();
    const ageSeconds = Math.floor(
      (Date.now() - new Date(row!.last_activity).getTime()) / 1000
    );
    // Still ~10s old — the throttled write must have been skipped. (A write
    // would have reset it to ~0s; the JS-side age read is only used against
    // a value the database itself stamped moments ago, with generous bounds.)
    expect(ageSeconds).toBeGreaterThanOrEqual(5);
  });

  it("writes after the throttle window has elapsed", async () => {
    const sid = uniqueSid("throttle-open");
    await recordSessionActivity({ sid, userId }, db);
    await ctx.pool.query(
      "UPDATE session_activity SET last_activity = now() - interval '120 seconds' WHERE sid = $1",
      [sid]
    );
    await recordSessionActivity({ sid, userId }, db);
    const row = await activityRow(sid);
    const ageSeconds = Math.floor(
      (Date.now() - new Date(row!.last_activity).getTime()) / 1000
    );
    expect(ageSeconds).toBeLessThan(5);
  });

  it("never refreshes a finalized row (idle-expired or sign-out revoked)", async () => {
    // Phase 20 regression: the conflict-UPDATE's throttle predicate alone
    // allowed a navigation/ping to slide last_activity back to now() AFTER
    // the row had been finalized — un-expiring an idle session, or
    // overwriting the sign-out tombstone (epoch) and resurrecting a
    // logged-out session. The flag guard must make such writes no-ops.
    const expiredSid = uniqueSid("finalized-expired");
    await recordSessionActivity({ sid: expiredSid, userId }, db);
    await ctx.pool.query(
      `UPDATE session_activity
       SET last_activity = now() - interval '20 minutes', expired_logged = true
       WHERE sid = $1`,
      [expiredSid]
    );
    await recordSessionActivity({ sid: expiredSid, userId }, db);
    const expiredRow = await activityRow(expiredSid);
    expect(expiredRow?.expired_logged).toBe(true);
    const expiredAgeMs =
      Date.now() - new Date(expiredRow!.last_activity).getTime();
    expect(expiredAgeMs).toBeGreaterThanOrEqual(19 * 60 * 1000);

    const revokedSid = uniqueSid("finalized-revoked");
    await recordSessionActivity({ sid: revokedSid, userId }, db);
    await tombstoneSessionActivity({ sid: revokedSid, userId }, db);
    // Epoch is far outside the throttle window, so the old predicate alone
    // would have allowed this write — the flag must block it.
    await recordSessionActivity({ sid: revokedSid, userId }, db);
    const revokedRow = await activityRow(revokedSid);
    expect(revokedRow?.expired_logged).toBe(true);
    expect(new Date(revokedRow!.last_activity).getTime()).toBeLessThan(
      10 * 24 * 60 * 60 * 1000
    );
  });

  it("evaluates the idle window against database time", async () => {
    const activeSid = uniqueSid("window-active");
    await recordSessionActivity({ sid: activeSid, userId }, db);
    await ctx.pool.query(
      `UPDATE session_activity SET last_activity = now() - interval '${IDLE - 10} seconds' WHERE sid = $1`,
      [activeSid]
    );
    expect(
      await checkSessionActivity(
        { sid: activeSid, userId, authAt: 0, idleSeconds: IDLE },
        db
      )
    ).toEqual({ kind: "active", role: "NURSE" });

    const expiredSid = uniqueSid("window-expired");
    await recordSessionActivity({ sid: expiredSid, userId }, db);
    await ctx.pool.query(
      `UPDATE session_activity SET last_activity = now() - interval '${IDLE + 10} seconds' WHERE sid = $1`,
      [expiredSid]
    );
    expect(
      await checkSessionActivity(
        { sid: expiredSid, userId, authAt: 0, idleSeconds: IDLE },
        db
      )
    ).toEqual({ kind: "idle_expired" });
  });

  it("returns the current database role so privilege changes apply at once", async () => {
    const sid = uniqueSid("role");
    await recordSessionActivity({ sid, userId }, db);
    const before = await checkSessionActivity(
      { sid, userId, authAt: 0, idleSeconds: IDLE },
      db
    );
    expect(before).toEqual({ kind: "active", role: "NURSE" });
    await ctx.pool.query("UPDATE users SET role = 'DOCTOR' WHERE id = $1", [
      userId,
    ]);
    const after = await checkSessionActivity(
      { sid, userId, authAt: 0, idleSeconds: IDLE },
      db
    );
    expect(after).toEqual({ kind: "active", role: "DOCTOR" });
    // Restore for the other tests.
    await ctx.pool.query("UPDATE users SET role = 'NURSE' WHERE id = $1", [
      userId,
    ]);
  });

  it("reports invalid once the user no longer exists", async () => {
    const { rows } = await ctx.pool.query(
      `INSERT INTO users (email, password, name, role, department)
       VALUES ($1, 'x', 'Doomed User', 'RECEPTION', 'Front Desk')
       RETURNING id`,
      [`session-activity-doomed-${Date.now()}@medcore.test`]
    );
    const doomedId = rows[0].id as string;
    const sid = uniqueSid("doomed");
    await recordSessionActivity({ sid, userId: doomedId }, db);
    await ctx.pool.query("DELETE FROM users WHERE id = $1", [doomedId]);
    expect(
      await checkSessionActivity(
        { sid, userId: doomedId, authAt: 0, idleSeconds: IDLE },
        db
      )
    ).toEqual({ kind: "invalid" });
  });

  it("reports invalid when the sid belongs to a different user", async () => {
    const sid = uniqueSid("mismatch");
    await recordSessionActivity({ sid, userId }, db);
    const { rows } = await ctx.pool.query(
      `INSERT INTO users (email, password, name, role, department)
       VALUES ($1, 'x', 'Other User', 'PHARMACY', 'Pharmacy')
       RETURNING id`,
      [`session-activity-other-${Date.now()}@medcore.test`]
    );
    const otherId = rows[0].id as string;
    try {
      const result = await checkSessionActivity(
        { sid, userId: otherId, authAt: 0, idleSeconds: IDLE },
        db
      );
      expect(result).toEqual({ kind: "invalid" });
    } finally {
      await ctx.pool.query("DELETE FROM users WHERE id = $1", [otherId]);
    }
  });

  it("sweeps only rows older than the retention window", async () => {
    const freshSid = uniqueSid("sweep-fresh");
    const staleSid = uniqueSid("sweep-stale");
    await recordSessionActivity({ sid: freshSid, userId }, db);
    await recordSessionActivity({ sid: staleSid, userId }, db);
    await ctx.pool.query(
      `UPDATE session_activity
       SET last_activity = now() - make_interval(hours => ${SESSION_ACTIVITY_RETENTION_HOURS + 1})
       WHERE sid = $1`,
      [staleSid]
    );
    await sweepStaleSessionActivity(db);
    expect(await activityRow(staleSid)).toBeUndefined();
    expect(await activityRow(freshSid)).toBeDefined();
  });

  it("marks an expiry as audited exactly once", async () => {
    const sid = uniqueSid("expired-flag");
    await recordSessionActivity({ sid, userId }, db);
    expect(await markSessionExpiredLogged(sid, db)).toBe(true);
    expect(await markSessionExpiredLogged(sid, db)).toBe(false);
    const row = await activityRow(sid);
    expect(row?.expired_logged).toBe(true);
  });

  // Phase 20: concurrency + boundary semantics (client retries and
  // multi-tab polling race these paths in production).

  it("concurrent first checks all resolve active and seed exactly one row", async () => {
    const sid = uniqueSid("race-seed");
    const now = Math.floor(Date.now() / 1000);
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        checkSessionActivity({ sid, userId, authAt: now, idleSeconds: IDLE }, db)
      )
    );
    for (const result of results) {
      expect(result).toEqual({ kind: "active", role: "NURSE" });
    }
    const { rows } = await ctx.pool.query(
      "SELECT count(*)::int AS n FROM session_activity WHERE sid = $1",
      [sid]
    );
    expect(rows[0].n).toBe(1);
  });

  it("concurrent expiry observations flip the audit flag exactly once", async () => {
    const sid = uniqueSid("race-flag");
    await recordSessionActivity({ sid, userId }, db);
    const outcomes = await Promise.all(
      Array.from({ length: 5 }, () => markSessionExpiredLogged(sid, db))
    );
    expect(outcomes.filter(Boolean)).toHaveLength(1);
  });

  it("holds active right up to the boundary and expires once the window is reached", async () => {
    // Within-window (2s of slack): active.
    const near = uniqueSid("near-active");
    await recordSessionActivity({ sid: near, userId }, db);
    await ctx.pool.query(
      `UPDATE session_activity SET last_activity = now() - interval '${IDLE - 2} seconds' WHERE sid = $1`,
      [near]
    );
    expect(
      await checkSessionActivity(
        { sid: near, userId, authAt: 0, idleSeconds: IDLE },
        db
      )
    ).toEqual({ kind: "active", role: "NURSE" });

    // At/after the boundary (>= 2s past): expired — the predicate is a
    // strict "last_activity > now() - idle", so age == idle already fails.
    const past = uniqueSid("near-expired");
    await recordSessionActivity({ sid: past, userId }, db);
    await ctx.pool.query(
      `UPDATE session_activity SET last_activity = now() - interval '${IDLE + 2} seconds' WHERE sid = $1`,
      [past]
    );
    expect(
      await checkSessionActivity(
        { sid: past, userId, authAt: 0, idleSeconds: IDLE },
        db
      )
    ).toEqual({ kind: "idle_expired" });
  });
});
