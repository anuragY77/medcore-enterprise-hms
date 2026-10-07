import { NextResponse, type NextRequest } from "next/server";
import { decode } from "next-auth/jwt";
import { handlers } from "@/lib/auth";
import { enforceSessionLiveness } from "@/lib/session-liveness";
import { db } from "@/lib/db";
import {
  createPgRateLimitStore,
  describeLoginAttempt,
  guardLoginAttempt,
  observeLoginAttempt,
} from "@/lib/login-rate-limit";
import {
  logSessionActivityFailure,
  tombstoneSessionActivity,
} from "@/lib/session-activity";
import { SESSION_SID_CLAIM } from "@/lib/session-config";

// IMPORTANT: Force dynamic to prevent Data Cache from caching session responses.
// Without this, the first user's session would be cached and served to all users.
export const dynamic = "force-dynamic";

const LEGACY_SESSION_COOKIE = "authjs.session-token";
const SECURE_SESSION_COOKIE = "__Secure-authjs.session-token";
const SIGNOUT_PATH = "/api/auth/signout";

/**
 * Phase 19: idle/liveness guard for GET /api/auth/session.
 *
 * Auth.js itself only knows the absolute lifetime (pure jwt callback), so an
 * idle-expired session would otherwise keep reporting itself as signed in
 * until the next navigation. When the server-side liveness gate rejects the
 * session we synthesize Auth.js's own logged-out response (null body,
 * cleared cookie) so every tab learns immediately — the stale cookie must
 * not survive, or each poll would repeat the whole check forever.
 * A live session passes through untouched (role staleness here is
 * cosmetic: authorization points read the role fresh from the database).
 */
async function enforceSessionResponse(
  request: NextRequest,
  response: Response
): Promise<Response> {
  if (!response.ok) return response;
  let body: unknown;
  try {
    body = await response.clone().json();
  } catch {
    return response; // not JSON — nothing to enforce
  }
  if (!body || typeof body !== "object" || !("user" in body)) {
    return response; // not signed in (null / empty session)
  }
  const live = await enforceSessionLiveness(
    body as Parameters<typeof enforceSessionLiveness>[0]
  );
  if (live) return response;

  const cookieName = request.cookies.has(SECURE_SESSION_COOKIE)
    ? SECURE_SESSION_COOKIE
    : LEGACY_SESSION_COOKIE;
  const headers = new Headers({
    "Content-Type": "application/json",
    "Cache-Control": "private, no-cache, no-store",
    Expires: "0",
    Pragma: "no-cache",
  });
  headers.append(
    "set-cookie",
    `${cookieName}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; HttpOnly; SameSite=Lax${
      cookieName.startsWith("__Secure-") ? "; Secure" : ""
    }`
  );
  return new Response(null, { status: 200, headers });
}

/**
 * Phase 20: revokes idle state when a session signs out.
 *
 * Auth.js JWT sessions are stateless — sign-out only clears the cookie, so
 * a concurrent GET /api/auth/session (another tab booting, an in-flight
 * poll) re-issues the still-valid token and its Set-Cookie can land AFTER
 * the clear: the browser resurrects the "logged out" session and the next
 * navigation bounces back to the app (reproduced intermittently by the
 * Phase 20 E2E probes). Writing the epoch tombstone (see
 * tombstoneSessionActivity) makes that resurrected token fail the liveness
 * gate on its very next request instead of resuming a live session.
 *
 * Phase 24: the success signal is the session-clearing Set-Cookie, not the
 * status class alone. Auth.js answers redirect-mode signout POSTs (any
 * client that does NOT send `X-Auth-Return-Redirect`, e.g. API/script
 * clients) with 302 — `response.ok` is false there, so gating on 2xx
 * silently skipped revocation and a saved copy of the cookie stayed fully
 * authenticated until idle/absolute expiry (reproduced live). A successful
 * signout ALWAYS clears the session cookie in Set-Cookie (200 JSON or 302),
 * while error paths (e.g. MissingCSRF) set no cookie at all — so tombstone
 * exactly when that clearing header is present on a 2xx/3xx response.
 *
 * Best-effort by policy: sign-out must succeed even during a store outage,
 * and liveness already fails closed for every request while the store is
 * unreachable. Decode failures (no/foreign/garbage cookie) simply skip the
 * tombstone — there is no live session to revoke.
 */
async function revokeOnSignout(
  request: NextRequest,
  response: Response
): Promise<Response> {
  if (new URL(request.url).pathname !== SIGNOUT_PATH) return response;
  if (!(response.ok || (response.status >= 300 && response.status < 400))) {
    return response;
  }
  const cookieName = request.cookies.has(SECURE_SESSION_COOKIE)
    ? SECURE_SESSION_COOKIE
    : LEGACY_SESSION_COOKIE;
  // Only a successful signout clears the session cookie; error redirects
  // (bad CSRF, configuration) set no cookie and must not revoke anything.
  const clearedSession = response.headers
    .getSetCookie()
    .some((entry) => entry.split(";")[0] === `${cookieName}=`);
  if (!clearedSession) return response;
  const token = request.cookies.get(cookieName)?.value;
  if (!token) return response;

  let payload: Record<string, unknown> | null;
  try {
    payload = (await decode({
      token,
      secret: process.env.AUTH_SECRET!,
      salt: cookieName,
    })) as Record<string, unknown> | null;
  } catch {
    // Corrupt/foreign token: nothing to revoke — and not a store failure,
    // so it must not be logged as one.
    return response;
  }
  const sid = payload?.[SESSION_SID_CLAIM];
  const userId = payload?.sub;
  if (typeof sid !== "string" || !sid || typeof userId !== "string" || !userId) {
    return response;
  }

  try {
    await tombstoneSessionActivity({ sid, userId });
  } catch (error) {
    logSessionActivityFailure("signout-revoke", error, "best-effort");
  }
  return response;
}

// Phase 17: every credentials sign-in attempt passes through the PostgreSQL-
// backed brute-force guard before NextAuth runs, and its outcome is observed
// afterwards (failed passwords count, successes clear, unrelated auth errors
// are ignored). The attempt (IP + email) is parsed ONCE here because NextAuth
// consumes the request body — a second parse after the handler would see an
// empty form. Other auth endpoints keep their own guards: session (GET,
// Phase 19), signout (POST revocation, Phase 20), csrf passthrough.
export async function GET(request: NextRequest) {
  return enforceSessionResponse(request, await handlers.GET(request));
}

export async function POST(request: NextRequest) {
  // Phase 23: Auth.js (5.0.0-beta.32) issues a full session for credentials
  // callbacks that carry a foreign Origin header — reproduced live with a
  // valid CSRF token and `Origin: https://evil.example`. The double-submit
  // CSRF token and SameSite=Lax cookies blunt this in a browser, but the
  // trust boundary must not depend on a header being ABSENT from the check:
  // reject any cross-origin POST before any auth work runs. Same policy as
  // POST /api/auth/activity (Phase 19): if an Origin is presented it must
  // match AUTH_URL (or the request URL when AUTH_URL is unset); requests
  // without an Origin (server-to-server, CLI probes) are unaffected.
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const expected = new URL(process.env.AUTH_URL ?? request.url).origin;
      if (new URL(origin).origin !== expected) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } catch {
      // Unparseable Origin (including the literal "null" from sandboxed
      // documents) is untrusted by definition.
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const attempt = await describeLoginAttempt(request);
  if (!attempt) {
    return revokeOnSignout(request, await handlers.POST(request));
  }

  const store = createPgRateLimitStore(db);
  const guarded = await guardLoginAttempt(attempt, store);
  if (guarded) return guarded;

  const response = await handlers.POST(request);
  await observeLoginAttempt(attempt, response, store);
  return response;
}
