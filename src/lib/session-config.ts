// Explicit session lifetime for MedCore (Phases 17 + 18).
//
// Design notes:
// - `maxAge` is an ABSOLUTE lifetime: a session is valid for 12 hours from
//   sign-in. The installed Auth.js (@auth/core beta.32) re-encodes the JWT
//   and refreshes the cookie on every /api/auth/session call, and its
//   `updateAge` option only throttles the DATABASE strategy — so config
//   alone cannot make a JWT session non-sliding. The absolute lifetime is
//   therefore enforced by `enforceAbsoluteSession`, which pins the sign-in
//   time in the `authAt` token claim (set by the jwt callback on first
//   issue) and rejects any token older than SESSION_MAX_AGE_SECONDS.
// - An IDLE (inactivity) timeout is intentionally NOT implemented here: it
//   requires per-request activity tracking server-side and is recorded as a
//   follow-up decision rather than a client-side redirect, which would not
//   be a real security control.
// - This module is config-only (no next-auth import) so tests and route
//   modules can read the constants without initializing NextAuth.
export const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;

/** Token claim that pins the true sign-in time inside the encrypted JWT. */
export const SESSION_AUTH_AT_CLAIM = "authAt";

export const sessionConfig = {
  strategy: "jwt",
  maxAge: SESSION_MAX_AGE_SECONDS,
} as const;

/**
 * Enforces the absolute session lifetime inside the jwt callback.
 *
 * - On first issue the callback stamps `authAt` (sign-in time) itself.
 * - Tokens minted before this claim existed adopt their own `iat` as the
 *   start (best effort — Auth.js re-stamps `iat` on every re-encode).
 * - Returns `null` once the token is older than the absolute lifetime, which
 *   makes Auth.js drop the session and clear the cookie.
 */
export function enforceAbsoluteSession<T extends Record<string, unknown>>(
  token: T,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): T | null {
  const claims = token as Record<string, unknown>;
  const raw = claims[SESSION_AUTH_AT_CLAIM];
  const iat = claims.iat;
  let start: number;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    start = raw;
  } else {
    // Legacy session minted before the claim existed: adopt its own issue
    // time as the absolute start (best effort — iat is re-stamped on
    // re-encode, so this grants at most one further lifetime).
    start = typeof iat === "number" && Number.isFinite(iat) ? iat : nowSeconds;
  }
  claims[SESSION_AUTH_AT_CLAIM] = start;
  if (nowSeconds - start >= SESSION_MAX_AGE_SECONDS) {
    return null;
  }
  return token;
}
