// Phase 20: enforceSessionResponse — the idle guard wrapping
// GET /api/auth/session (Phase 19 "Case E"). This exercises the REAL
// wrapped handler against the REAL database with a crafted (but
// correctly-signed) session cookie, which the mocked unit suites cannot:
//
//  1. a live session passes through untouched and polling does NOT record
//     activity (the row keeps its authAt seed — polling can never slide
//     the idle clock);
//  2. an idle-expired session gets Auth.js's logged-out shape (null body +
//     cleared cookie) with EXACTLY ONE "auth.session_idle_expired" audit —
//     a second poll must not audit again (one-shot flag);
//  3. a missing row for an old sign-in seeds from authAt (no fresh grace
//     window) and lands already expired;
//  4. an anonymous poll is a plain null with no audit side effects;
//  5. a sign-out-revoked (tombstoned) session fails closed on its next
//     poll without emitting a spurious idle-expiry audit.
//
// Order matters: setupIntegration() must run while DATABASE_URL still
// points at the unit placeholder (the guard refuses identical databases),
// then DATABASE_URL is pointed at the test database BEFORE the route
// module is imported, because src/lib/db reads it at load time.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  integrationEnabled,
  setupIntegration,
  teardownIntegration,
  type IntegrationContext,
} from "./helpers";

const RUN = integrationEnabled;
const COOKIE_NAME = "authjs.session-token";
const SESSION_URL = "http://localhost:3000/api/auth/session";

type RouteModule = typeof import("@/app/api/auth/[...nextauth]/route");
type DbModule = typeof import("@/lib/db");

interface PollResult {
  status: number;
  body: Record<string, unknown> | null;
  setCookies: string[];
}

describe.skipIf(!RUN)("session endpoint idle guard integration", () => {
  let ctx: IntegrationContext;
  let route: RouteModule;
  let dbModule: DbModule;
  let userId: string;
  let email: string;
  const sid = `guard-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  async function craftToken(payload: Record<string, unknown>): Promise<string> {
    const { encode } = await import("next-auth/jwt");
    return (await encode({
      token: payload,
      secret: process.env.AUTH_SECRET!,
      salt: COOKIE_NAME,
    })) as string;
  }

  async function poll(token: string | null): Promise<PollResult> {
    const { NextRequest } = await import("next/server");
    const request = new NextRequest(SESSION_URL, {
      headers: token ? { cookie: `${COOKIE_NAME}=${token}` } : {},
    });
    const response = await route.GET(request);
    const text = await response.text();
    let body: Record<string, unknown> | null = null;
    try {
      body = text ? (JSON.parse(text) as Record<string, unknown>) : null;
    } catch {
      body = null;
    }
    return {
      status: response.status,
      body,
      setCookies: response.headers.getSetCookie(),
    };
  }

  function validPayload(overrides: Record<string, unknown> = {}) {
    return {
      sub: userId,
      name: "Guard User",
      email,
      role: "NURSE",
      department: "Emergency",
      sid,
      authAt: Math.floor(Date.now() / 1000) - 5,
      ...overrides,
    };
  }

  async function sessionRow(targetSid: string) {
    const { rows } = await ctx.pool.query(
      `SELECT last_activity,
              EXTRACT(EPOCH FROM (now() - last_activity))::numeric(10,2) AS age_seconds,
              expired_logged
       FROM session_activity WHERE sid = $1`,
      [targetSid]
    );
    return rows[0] as
      | { last_activity: Date; age_seconds: string; expired_logged: boolean }
      | undefined;
  }

  async function expiryAuditCount(): Promise<number> {
    const { rows } = await ctx.pool.query(
      `SELECT count(*)::int AS n FROM audit_logs
       WHERE action = 'auth.session_idle_expired' AND actor_id = $1`,
      [userId]
    );
    return rows[0].n as number;
  }

  function clearedSessionCookie(setCookies: string[]): boolean {
    return setCookies.some(
      (line) =>
        line.startsWith(`${COOKIE_NAME}=;`) &&
        (line.includes("Max-Age=0") || line.includes("1970"))
    );
  }

  beforeAll(async () => {
    process.env.AUTH_SECRET ??= "test-only-session-secret-not-a-real-secret";
    process.env.AUTH_URL ??= "http://localhost:3000";
    ctx = await setupIntegration();
    // Now that the guard has verified DATABASE_URL differs from the test
    // database, point the app pool at the test database for this worker.
    process.env.DATABASE_URL = ctx.url;
    email = `session-guard-${Date.now()}@medcore.test`;
    const { rows } = await ctx.pool.query(
      `INSERT INTO users (email, password, name, role, department)
       VALUES ($1, 'x', 'Guard User', 'NURSE', 'Emergency')
       RETURNING id`,
      [email]
    );
    userId = rows[0].id as string;
    route = await import("@/app/api/auth/[...nextauth]/route");
    dbModule = await import("@/lib/db");
  });

  afterAll(async () => {
    if (ctx) {
      // audit_logs.actor_id is ON DELETE RESTRICT: audits must go first.
      await ctx.pool.query("DELETE FROM audit_logs WHERE actor_id = $1", [
        userId,
      ]);
      await ctx.pool.query("DELETE FROM users WHERE id = $1", [userId]);
      // End the route module's own pool (lazily created at import) so the
      // worker can exit; the drizzle instance exposes the pg Pool as
      // $client. Optional-chained for schema-shape drift.
      await Promise.resolve(
        (dbModule?.db as unknown as { $client?: { end(): Promise<void> } })
          ?.$client?.end()
      );
    }
    await teardownIntegration(ctx);
  });

  it("passes a live session through and polling never records activity", async () => {
    const token = await craftToken(validPayload());
    const first = await poll(token);
    expect(first.status).toBe(200);
    expect(first.body).not.toBeNull();
    const user = (first.body as { user?: { email?: string } }).user;
    expect(user?.email).toBe(email);

    // Row seeded from authAt (~5s ago), not from now(): age must reflect
    // the sign-in seed even after a poll.
    const seeded = await sessionRow(sid);
    expect(seeded).toBeDefined();
    expect(Number(seeded!.age_seconds)).toBeGreaterThanOrEqual(3);

    // Poll again (same token): last_activity must be byte-identical —
    // polling can neither refresh nor slide the idle clock.
    const second = await poll(token);
    expect(second.status).toBe(200);
    const after = await sessionRow(sid);
    expect(new Date(after!.last_activity).getTime()).toBe(
      new Date(seeded!.last_activity).getTime()
    );
    expect(after!.expired_logged).toBe(false);
    expect(await expiryAuditCount()).toBe(0);
  });

  it("synthesizes null + cleared cookie for an idle-expired session and audits exactly once", async () => {
    // Move the row past the configured idle window (DB-side, like production).
    const idleSeconds = 900; // SESSION_IDLE_TIMEOUT_SECONDS default
    await ctx.pool.query(
      `UPDATE session_activity
       SET last_activity = now() - make_interval(secs => $2::double precision)
       WHERE sid = $1`,
      [sid, idleSeconds + 5]
    );
    const auditsBefore = await expiryAuditCount();

    const token = await craftToken(validPayload());
    const first = await poll(token);
    expect(first.status).toBe(200);
    expect(first.body).toBeNull(); // Auth.js logged-out shape
    expect(clearedSessionCookie(first.setCookies)).toBe(true);
    expect(await expiryAuditCount()).toBe(auditsBefore + 1);

    // Second poll from the same abandoned tab: still null, still cleared,
    // and NO second audit (one-shot expired_logged flag).
    const second = await poll(token);
    expect(second.body).toBeNull();
    expect(await expiryAuditCount()).toBe(auditsBefore + 1);
    expect((await sessionRow(sid))?.expired_logged).toBe(true);
  });

  it("seeds a missing row from an old authAt and lands already expired (no grace window)", async () => {
    const staleSid = `${sid}-stale`;
    const staleAuthAt = Math.floor(Date.now() / 1000) - 900 - 60;
    const auditsBefore = await expiryAuditCount();

    const token = await craftToken(
      validPayload({ sid: staleSid, authAt: staleAuthAt })
    );
    const res = await poll(token);
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
    expect(clearedSessionCookie(res.setCookies)).toBe(true);
    expect(await expiryAuditCount()).toBe(auditsBefore + 1);

    // The seed used authAt, not now(): last_activity is ~960s old.
    const row = await sessionRow(staleSid);
    expect(row).toBeDefined();
    expect(Number(row!.age_seconds)).toBeGreaterThanOrEqual(890);
    expect(row!.expired_logged).toBe(true);
  });

  it("serves a plain null to anonymous polls with no audit side effects", async () => {
    const auditsBefore = await expiryAuditCount();
    const res = await poll(null);
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
    expect(await expiryAuditCount()).toBe(auditsBefore);
  });

  it("rejects a sign-out-resurrected session via the tombstone without audit noise", async () => {
    // Phase 20 bug: a concurrent session poll can re-set the cookie AFTER
    // sign-out cleared it. The POST wrapper's tombstone (epoch last_activity
    // + expired_logged pre-flipped) must make that resurrected token fail
    // liveness on its very next request — silently, without the one-shot
    // idle-expiry audit (the user simply signed out).
    const revokedSid = `${sid}-revoked`;
    const token = await craftToken(validPayload({ sid: revokedSid }));
    const auditsBefore = await expiryAuditCount();

    // Live before sign-out.
    const before = await poll(token);
    expect(before.status).toBe(200);
    expect(before.body).not.toBeNull();

    // What revokeOnSignout writes when POST /api/auth/signout succeeds.
    const { tombstoneSessionActivity, recordSessionActivity } = await import(
      "@/lib/session-activity"
    );
    await tombstoneSessionActivity({ sid: revokedSid, userId });

    // Regression (Phase 20 probe): the sign-out redirect's navigation used
    // to refresh last_activity through recordSessionActivity's conflict
    // UPDATE, un-tombstoning the row and resurrecting the logged-out
    // session. A write after the tombstone must be a no-op.
    await recordSessionActivity({ sid: revokedSid, userId });
    const tombstoned = await ctx.pool.query(
      `SELECT last_activity FROM session_activity WHERE sid = $1`,
      [revokedSid]
    );
    expect(
      new Date(tombstoned.rows[0].last_activity as string).getTime()
    ).toBeLessThan(10 * 24 * 60 * 60 * 1000);

    // Resurrected token: next poll fails closed with the logged-out shape.
    const after = await poll(token);
    expect(after.status).toBe(200);
    expect(after.body).toBeNull();
    expect(clearedSessionCookie(after.setCookies)).toBe(true);

    // Pre-flipped flag: no spurious auth.session_idle_expired audit.
    expect(await expiryAuditCount()).toBe(auditsBefore);
    const { rows } = await ctx.pool.query(
      `SELECT last_activity, expired_logged FROM session_activity WHERE sid = $1`,
      [revokedSid]
    );
    expect(rows[0].expired_logged).toBe(true);
    // Epoch tombstone: within 10 days of 1970 regardless of session TZ.
    expect(new Date(rows[0].last_activity as string).getTime()).toBeLessThan(
      10 * 24 * 60 * 60 * 1000
    );
  });
});
