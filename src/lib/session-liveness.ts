// Phase 19: the central idle/privilege liveness gate.
//
// enforceSessionLiveness is the ONE place that decides whether a session
// derived from a valid JWT may still be used, and it is deliberately
// called from the enforcement boundaries (wrapped auth(), the middleware
// wrapper, and the /api/auth/session response guard) rather than from the
// pure jwt callback — keeping the jwt callback free of database access
// preserves Phase 18's no-DB session-lifetime tests and makes this logic
// unit-testable with injected stores.
//
// Failure policy — FAIL-CLOSED: if the activity store cannot be reached,
// the session is rejected and the failure is logged (classified as outage
// vs defect, same classifier as the login rate limiter). Rationale: every
// protected resource also requires the database, so during an outage the
// user cannot receive protected data anyway — while failing open would
// silently disable idle enforcement for the whole window of the outage.
import type { Session } from "next-auth";
import type { Role } from "@/types/auth";
import { recordAudit } from "./audit";
import {
  checkSessionActivity,
  logSessionActivityFailure,
  markSessionExpiredLogged,
  type SessionCheckInput,
  type SessionLiveness,
} from "./session-activity";
import { SESSION_IDLE_TIMEOUT_SECONDS } from "./session-config";

export interface SessionLivenessDeps {
  check?: (input: SessionCheckInput) => Promise<SessionLiveness>;
  markExpired?: (sid: string) => Promise<boolean>;
  audit?: typeof recordAudit;
  idleSeconds?: number;
}

/**
 * Returns the (possibly role-refreshed) session when it is still live,
 * or `null` when it must be treated as expired.
 *
 * - Idle expiry: audited exactly once per session (one-shot flag in the
 *   activity row) so an abandoned open tab cannot flood the audit log.
 * - Privilege changes: the role is taken from the database on every call,
 *   so a role change applies at the very next authorized request; the
 *   JWT's copied role claim refreshes at the next sign-in. A deleted user
 *   (or a sid belonging to someone else) is `invalid` → rejected.
 * - Store failure: fails closed (see header).
 */
export async function enforceSessionLiveness(
  session: Session | null | undefined,
  deps: SessionLivenessDeps = {}
): Promise<Session | null> {
  if (!session?.user?.id || !session.sessionId) return null;

  const check = deps.check ?? checkSessionActivity;
  const markExpired = deps.markExpired ?? markSessionExpiredLogged;
  const audit = deps.audit ?? recordAudit;

  try {
    const result = await check({
      sid: session.sessionId,
      userId: session.user.id,
      authAt: session.authAt ?? 0,
      idleSeconds: deps.idleSeconds ?? SESSION_IDLE_TIMEOUT_SECONDS,
    });

    if (result.kind === "active") {
      if (result.role !== session.user.role) {
        session.user.role = result.role as Role;
      }
      return session;
    }

    if (result.kind === "idle_expired") {
      let firstObservation = false;
      try {
        firstObservation = await markExpired(session.sessionId);
      } catch (error) {
        logSessionActivityFailure("expiry-mark", error, "failing closed");
      }
      if (firstObservation) {
        try {
          await audit({
            actorId: session.user.id,
            action: "auth.session_idle_expired",
            entityType: "user",
            entityId: session.user.id,
            severity: "WARNING",
            category: "auth",
            success: false,
            metadata: null,
          });
        } catch (error) {
          logSessionActivityFailure("expiry-audit", error, "failing closed");
        }
      }
      return null;
    }

    // kind === "invalid": user deleted or sid owned by someone else.
    return null;
  } catch (error) {
    logSessionActivityFailure("liveness-check", error, "failing closed");
    return null;
  }
}
