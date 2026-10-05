// Phase 19: shared PostgreSQL activity state for the server-side idle
// timeout (approach C from the Phase 19 brief).
//
// Why shared state (not a JWT claim): the installed Auth.js re-encodes the
// JWT on every /api/auth/session call, so any claim we stamp inside a
// callback would be rewritten by ordinary polling — polling would slide the
// idle clock and the "timeout" would be decorative. Activity is therefore
// recorded only from server-observed meaningful events (page navigations in
// src/proxy.ts, user-input pings at /api/auth/activity) and evaluated here
// against PostgreSQL time.
//
// Time handling: every comparison runs in the database (now() vs
// last_activity). Nothing compares JavaScript Dates to database timestamps,
// which sidesteps the naive-timestamp local-parse skew found in Phase 18.
// JavaScript only reads back booleans and roles.
//
// Throttling: writes are conditional (`ON CONFLICT ... WHERE last_activity <
// now() - throttle`), so even a tab firing pings every minute performs at
// most one UPDATE per throttle window — never a write per request.
//
// Failure policy: the STORE functions here do not decide fail-open vs
// fail-closed — callers do (enforceSessionLiveness fails CLOSED and logs
// via logSessionActivityFailure; navigation recording is best-effort). The
// classifier is shared with the login rate limiter so outage logs stay
// distinguishable from defects.
import { and, eq, lt, sql } from "drizzle-orm";
import { db, sessionActivity, users } from "@/lib/db";
import type { Db, Tx } from "@/lib/db/seed/types";
import { isTransientStoreError } from "@/lib/login-rate-limit";
import {
  SESSION_ACTIVITY_RETENTION_HOURS,
  SESSION_ACTIVITY_THROTTLE_SECONDS,
  SESSION_IDLE_TIMEOUT_SECONDS,
} from "@/lib/session-config";

export type SessionActivityDb = Db | Tx;

export type SessionLiveness =
  /** Row exists, user exists, within the idle window. */
  | { kind: "active"; role: string }
  /** Row exists but last meaningful activity is older than the window. */
  | { kind: "idle_expired" }
  /** User deleted, or the sid does not belong to this user. */
  | { kind: "invalid" };

export interface SessionCheckInput {
  /** Stable per-login session id (the token `sid` claim). */
  sid: string;
  /** user_id from the session — enforced to match the row's owner. */
  userId: string;
  /** Absolute sign-in time (epoch seconds) used only to seed a missing row. */
  authAt: number;
  /** Idle window; defaults to the configured SESSION_IDLE_TIMEOUT_SECONDS. */
  idleSeconds?: number;
}

interface LivenessRow {
  role: string;
  active: boolean;
}

function loadState(sid: string, userId: string, idleSeconds: number) {
  return sql<LivenessRow>`
    SELECT u.role AS role,
           (sa.last_activity > now() - ${idleSeconds}::integer * interval '1 second') AS active
    FROM session_activity sa
    JOIN users u ON u.id = sa.user_id
    WHERE sa.sid = ${sid} AND u.id = ${userId}
    LIMIT 1`;
}

function evaluate(row: LivenessRow | undefined): SessionLiveness | null {
  if (!row) return null;
  return row.active ? { kind: "active", role: row.role } : { kind: "idle_expired" };
}

/**
 * Evaluates whether a session is still live: user exists, sid belongs to
 * it, and meaningful activity is within the idle window.
 *
 * Missing-row policy: the row is seeded ONCE from the token's absolute
 * sign-in time — never from "now" — so a session without recorded activity
 * (pre-migration cookies, activity writes that failed during an outage)
 * gets no fresh grace window. A seed derived from an old sign-in lands
 * already expired.
 */
export async function checkSessionActivity(
  input: SessionCheckInput,
  handle: SessionActivityDb = db
): Promise<SessionLiveness> {
  const idleSeconds = input.idleSeconds ?? SESSION_IDLE_TIMEOUT_SECONDS;

  const existing = await handle.execute(
    loadState(input.sid, input.userId, idleSeconds)
  );
  const hit = evaluate((existing.rows as unknown as LivenessRow[])[0]);
  if (hit) return hit;

  // No matching row: confirm the user still exists before seeding, so a
  // deleted user is rejected instead of resurrected with a fresh row.
  const [user] = await handle
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);
  if (!user) return { kind: "invalid" };

  await handle
    .insert(sessionActivity)
    .values({
      sid: input.sid,
      userId: input.userId,
      lastActivity: sql`to_timestamp(${input.authAt})`,
    })
    .onConflictDoNothing();

  // Re-evaluate: a concurrent request may have recorded fresher activity
  // between our read and the insert; a persistent miss means the sid is
  // owned by a different user (never a match — fail closed).
  const reloaded = await handle.execute(
    loadState(input.sid, input.userId, idleSeconds)
  );
  return evaluate((reloaded.rows as unknown as LivenessRow[])[0]) ?? {
    kind: "invalid",
  };
}

/**
 * Records meaningful activity. Conditional on the throttle so a chatty
 * client performs at most one UPDATE per SESSION_ACTIVITY_THROTTLE_SECONDS
 * per session; the insert path (no row yet) always writes. Callers must
 * have already verified the session is live — this never resurrects an
 * expired one, because expired sessions are rejected before reaching here.
 *
 * Phase 20: the conflict-update also requires `expired_logged = false`.
 * A finalized sid (idle-expired, or tombstoned by sign-out) must stay dead:
 * without the flag guard, a navigation/ping whose UPDATE lands AFTER the
 * expiry mark or sign-out tombstone would slide last_activity back to now()
 * and un-expire the session (reproduced when the sign-out tombstone was
 * overwritten by the redirect navigation, resurrecting a logged-out
 * session). Postgres re-evaluates the predicate at execution time, so any
 * interleave with tombstoneSessionActivity ends with the row finalized.
 */
export async function recordSessionActivity(
  input: { sid: string; userId: string },
  handle: SessionActivityDb = db
): Promise<void> {
  await handle
    .insert(sessionActivity)
    .values({ sid: input.sid, userId: input.userId })
    .onConflictDoUpdate({
      target: sessionActivity.sid,
      set: { lastActivity: sql`now()` },
      setWhere: sql`${sessionActivity.lastActivity} < now() - ${SESSION_ACTIVITY_THROTTLE_SECONDS}::integer * interval '1 second' AND ${sessionActivity.expiredLogged} = false`,
    });
}

/**
 * One-shot flag so an idle expiry is audited exactly once per session
 * instead of on every request from an abandoned still-open tab.
 * Returns true only for the call that flipped the flag.
 */
export async function markSessionExpiredLogged(
  sid: string,
  handle: SessionActivityDb = db
): Promise<boolean> {
  const updated = await handle
    .update(sessionActivity)
    .set({ expiredLogged: true })
    .where(
      and(
        eq(sessionActivity.sid, sid),
        eq(sessionActivity.expiredLogged, false)
      )
    )
    .returning({ sid: sessionActivity.sid });
  return updated.length > 0;
}

/**
 * Phase 20: revokes a session's idle state at sign-out.
 *
 * Auth.js JWT sessions are stateless: sign-out only clears the cookie, so
 * a concurrent GET /api/auth/session (another tab booting, a poll in
 * flight) can re-issue the still-valid token AFTER the clear — the browser
 * applies that Set-Cookie and the "logged out" session is resurrected
 * (reproduced intermittently by the Phase 20 E2E probes). Writing an
 * ancient last_activity tombstone makes the resurrected token fail the
 * liveness check on its very next request instead of resuming a live
 * session. expiredLogged is pre-flipped so the forced rejection does not
 * emit a spurious idle-expiry audit — the user simply signed out.
 *
 * Best-effort by policy: sign-out must succeed even during a store outage,
 * and liveness already fails closed for every request while the store is
 * unreachable (see enforceSessionLiveness).
 */
export async function tombstoneSessionActivity(
  input: { sid: string; userId: string },
  handle: SessionActivityDb = db
): Promise<void> {
  await handle
    .insert(sessionActivity)
    .values({
      sid: input.sid,
      userId: input.userId,
      lastActivity: sql`to_timestamp(0)`,
      expiredLogged: true,
    })
    .onConflictDoUpdate({
      target: sessionActivity.sid,
      set: {
        lastActivity: sql`to_timestamp(0)`,
        expiredLogged: true,
      },
    });
}

/**
 * Opportunistic pruning (called after successful sign-in). Retention
 * exceeds the 12h absolute lifetime, so pruning can never remove the state
 * of a session that could still be valid. Errors propagate to the caller,
 * which treats pruning as best-effort (never blocks login).
 */
export async function sweepStaleSessionActivity(
  handle: SessionActivityDb = db
): Promise<void> {
  await handle
    .delete(sessionActivity)
    .where(
      lt(
        sessionActivity.lastActivity,
        sql`now() - ${SESSION_ACTIVITY_RETENTION_HOURS}::integer * interval '1 hour'`
      )
    );
}

/**
 * Classifies store failures for logging. Reuses the rate limiter's
 * transient/defect classifier so outage logs read consistently across the
 * codebase; `disposition` states the caller's failure policy (e.g.
 * "failing closed" vs best-effort) so the log line is unambiguous.
 */
export function logSessionActivityFailure(
  operation: string,
  error: unknown,
  disposition?: string
): void {
  const tail = disposition ? `, ${disposition}` : "";
  if (isTransientStoreError(error)) {
    console.error(
      `session activity ${operation} failed — database unavailable${tail}:`,
      error
    );
  } else {
    console.error(
      `session activity ${operation} failed — unexpected session-store error (possible defect)${tail}:`,
      error
    );
  }
}
