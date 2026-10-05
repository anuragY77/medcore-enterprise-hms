// Explicit session lifetime for MedCore (Phases 17-19).
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
// - Phase 19 adds an IDLE (inactivity) timeout enforced server-side against
//   shared PostgreSQL activity state (src/lib/session-activity.ts). The idle
//   window NEVER extends the absolute lifetime: both checks run on every
//   authenticated request and a session must pass each one. Idle state is
//   deliberately not a JWT claim — Auth.js re-encodes on every session
//   poll, so a claim-based approach would slide on polling alone.
// - This module is config-only (no next-auth import) so tests and route
//   modules can read the constants without initializing NextAuth.
export const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;

/** Token claim that pins the true sign-in time inside the encrypted JWT. */
export const SESSION_AUTH_AT_CLAIM = "authAt";

/**
 * Token claim carrying the stable per-login session identifier used to key
 * PostgreSQL activity state. NOT Auth.js's `jti`: the installed encode()
 * mints a fresh jti on every re-encode, so jti changes on each session
 * poll. `sid` is stamped once by the jwt callback and persists for the
 * life of the login.
 */
export const SESSION_SID_CLAIM = "sid";

// --- Idle timeout configuration (server-side, validated) ------------------
//
// SESSION_IDLE_TIMEOUT_MINUTES: inactivity minutes before the server
// rejects the session. Chosen default: 15 minutes — the common clinical
// guidance for PHI systems (shared ward terminals), and short enough to
// bound an abandoned session while long enough that an actively charting
// clinician never fights it (real input re-records activity continuously).
// The lower bound is 1 minute: the bound exists so a typo (0/empty/garbage)
// can never DISABLE enforcement or leave a terminal unattended for days —
// operators who want a tighter window than the default may have one (short
// windows are also what browser tests exercise).
export const SESSION_IDLE_DEFAULT_MINUTES = 15;
export const SESSION_IDLE_MIN_MINUTES = 1;
export const SESSION_IDLE_MAX_MINUTES = 480;

/**
 * Maximum gap between meaningful-activity writes, as a function of the
 * idle window: at most idle/6 (clamped to [5s, 60s]). Keeping the throttle
 * proportional means a short configured window (e.g. a 1-minute E2E
 * timeout) still gets writes often enough to be observable — with a fixed
 * 60s throttle, staleness could reach ~2×60s and expire an ACTIVE session.
 * The ping interval below is idle/3, so worst-case staleness
 * (ping + throttle) is ≤ idle/2 < idle for every legal window.
 */
export function activityThrottleSeconds(idleSeconds: number): number {
  return Math.max(5, Math.min(60, Math.floor(idleSeconds / 6)));
}

/**
 * Client-side minimum gap between activity pings (SessionActivityMonitor),
 * derived from the same idle window: idle/3 clamped to [5s, 60s].
 * Defaults (900s) → 60s, unchanged from the original fixed interval.
 */
export function activityPingIntervalSeconds(idleSeconds: number): number {
  return Math.max(5, Math.min(60, Math.floor(idleSeconds / 3)));
}

/**
 * Rows untouched for this long are pruned opportunistically on login.
 * 24h > the 12h absolute lifetime, so pruning can never remove the state
 * of a session that could still be valid.
 */
export const SESSION_ACTIVITY_RETENTION_HOURS = 24;

export type IdleTimeoutParse =
  | { ok: true; minutes: number }
  | { ok: false; reason: string };

/**
 * Validates the idle timeout configuration value. Pure and dependency-free
 * so the bounds policy is unit-testable without booting NextAuth.
 * Unset/empty means "use the default" (ok: true) — only present-but-invalid
 * values are rejected.
 */
export function parseIdleTimeoutMinutes(
  raw: string | undefined | null
): IdleTimeoutParse {
  if (raw == null || raw.trim() === "") {
    return { ok: true, minutes: SESSION_IDLE_DEFAULT_MINUTES };
  }
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    return {
      ok: false,
      reason: "must be a whole number of minutes",
    };
  }
  const minutes = Number(trimmed);
  if (minutes < SESSION_IDLE_MIN_MINUTES || minutes > SESSION_IDLE_MAX_MINUTES) {
    return {
      ok: false,
      reason: `must be between ${SESSION_IDLE_MIN_MINUTES} and ${SESSION_IDLE_MAX_MINUTES}`,
    };
  }
  return { ok: true, minutes };
}

/**
 * Resolves the idle timeout in seconds. An invalid configured value falls
 * back to the default (with a loud warning) rather than crashing startup:
 * failing to boot a hospital system over a config typo is worse than the
 * default window, and the warning keeps the defect visible.
 */
export function resolveIdleTimeoutSeconds(
  raw: string | undefined | null
): number {
  const parsed = parseIdleTimeoutMinutes(raw);
  if (parsed.ok) return parsed.minutes * 60;
  console.warn(
    `Ignoring invalid SESSION_IDLE_TIMEOUT_MINUTES (${parsed.reason}) — ` +
      `using default ${SESSION_IDLE_DEFAULT_MINUTES} minutes.`
  );
  return SESSION_IDLE_DEFAULT_MINUTES * 60;
}

/** Effective idle window for this process (read once at module load). */
export const SESSION_IDLE_TIMEOUT_SECONDS = resolveIdleTimeoutSeconds(
  process.env.SESSION_IDLE_TIMEOUT_MINUTES
);

/** Throttle applied to this process's configured idle window. */
export const SESSION_ACTIVITY_THROTTLE_SECONDS = activityThrottleSeconds(
  SESSION_IDLE_TIMEOUT_SECONDS
);

/**
 * Client-facing warning lead time: shown before the server would expire
 * the session. Capped at 2 minutes for the default window; scales down for
 * short (E2E) timeouts so the warning never appears after expiry.
 */
export function idleWarningSecondsBefore(idleSeconds: number): number {
  return Math.min(120, Math.max(1, Math.floor(idleSeconds * 0.2)));
}

/** Warning lead time for this process's configured idle window. */
export const SESSION_IDLE_WARNING_SECONDS_BEFORE =
  idleWarningSecondsBefore(SESSION_IDLE_TIMEOUT_SECONDS);

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
