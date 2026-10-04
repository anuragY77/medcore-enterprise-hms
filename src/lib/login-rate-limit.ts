// Server-side brute-force protection for the credentials login flow.
//
// Boundary: every POST to /api/auth/callback/credentials is parsed once via
// `describeLoginAttempt` (BEFORE NextAuth consumes the body), then
// `guardLoginAttempt` runs before NextAuth and `observeLoginAttempt` after
// NextAuth responds — all wired in src/app/api/auth/[...nextauth]/route.ts.
//
// Keying strategy (defense in depth, all normalized with trim + lowercase):
//   - pair:   "<ip>|<email>" — targeted brute force from one source (tightest)
//   - ip:     one source spraying many accounts / password lists
//   - account: one account attacked from many sources. The account threshold
//     is the highest so a third party cannot cheaply deny a victim access;
//     any account block is temporary (one block window) — never permanent.
//
// Storage: PostgreSQL `login_rate_limits` (committed migration), so the
// limiter works across multiple app instances — no in-memory counters.
//
// Failure policy — FAIL-OPEN, deliberately: if the limiter store is
// unavailable, login proceeds (availability over strictness for a demo
// hospital system) and the error is logged. Failing closed would let a
// database outage lock every clinician out of the hospital system. Fail-open
// is applied uniformly (transient outages AND unexpected errors), but the two
// cases are logged distinctly so a real defect cannot hide behind "outage".
//
// Trust boundary (Phase 18): the client address is taken from the LAST
// x-forwarded-for entry — the address appended by the nearest proxy (a
// client-supplied prefix cannot override it), not the first (client-spoofable
// in every topology). Next.js only fills x-forwarded-for from the socket when
// the header is absent, so a DIRECTLY exposed deployment must either disable
// header-based IP keying or sit behind a reverse proxy that OVERWRITES
// x-forwarded-for (see README "Security & Hardening"). Address tokens are
// validated (IPv4/IPv6 via net.isIP) and normalized, so a garbage header can
// only ever produce the shared "unknown" key — never an unbounded one.
//
// Privacy: only normalized identifiers, counters and timestamps are stored.
// No passwords, no request bodies, no IP-to-identity mapping beyond the
// attempt itself. Rate-limit state is never exposed to unauthenticated
// callers beyond a generic 429 with Retry-After.
import { isIP } from "node:net";
import { and, eq, gt, inArray, lt, sql } from "drizzle-orm";
import { loginRateLimits } from "@/lib/db";
import type { Db, Tx } from "@/lib/db/seed/types";

export type RateLimitDb = Db | Tx;

export interface RateLimitPolicy {
  /** Rolling window used to count failures per key. */
  windowMs: number;
  /** How long a key stays blocked once its threshold is reached. */
  blockMs: number;
  maxFailuresPerPair: number;
  maxFailuresPerIp: number;
  maxFailuresPerAccount: number;
}

// Thresholds are internal policy: the README documents behavior, not numbers.
export const LOGIN_RATE_LIMIT_POLICY: RateLimitPolicy = {
  windowMs: 15 * 60_000,
  blockMs: 15 * 60_000,
  maxFailuresPerPair: 5,
  maxFailuresPerIp: 20,
  maxFailuresPerAccount: 30,
};

/** Rows untouched for this long are pruned opportunistically on write. */
const RETENTION_MS = 24 * 60 * 60_000;

/**
 * `login_rate_limits.key` is varchar(200); every built key must fit it.
 * `pair:` (5) + worst-case IPv6 (45) + `|` (1) = 51, leaving 149 for the
 * normalized email. Identifiers longer than that are treated as unparseable
 * (IP-only throttling) instead of producing a key PostgreSQL would reject —
 * a rejected insert used to skip counting for the entire attempt.
 */
export const RATE_LIMIT_KEY_MAX_LENGTH = 200;
const MAX_EMAIL_KEY_LENGTH = RATE_LIMIT_KEY_MAX_LENGTH - 51;

/**
 * Classifies store failures so fail-open logging distinguishes a real
 * database outage from what is almost certainly a programming defect
 * (constraint violation, missing column, bad data) that would otherwise be
 * silently mislabeled as "the database was down".
 */
export function isTransientStoreError(error: unknown): boolean {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : "";
  if (/^(ECONN|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|EPIPE)/.test(code)) return true;
  // PostgreSQL: 08xxx connection, 40001/40P01 serialization/deadlock,
  // 53xxx resource, 55P03 lock-not-available, 57P01-03 shutdown.
  if (/^(08|40001|40P01|53|55P03|57P0)/.test(code)) return true;
  const message = error instanceof Error ? error.message : "";
  return /timeout|connection|terminated|ECONNREFUSED|deadlock|server closed/i.test(
    message
  );
}

function logStoreFailure(operation: string, error: unknown): void {
  if (isTransientStoreError(error)) {
    console.error(
      `login rate-limit ${operation} failed — database unavailable, failing open:`,
      error
    );
  } else {
    console.error(
      `login rate-limit ${operation} failed — unexpected limiter error (possible defect), failing open:`,
      error
    );
  }
}

/** Case/whitespace-insensitive so ` Admin@X ` and `admin@x` share a key. */
export function normalizeLoginIdentifier(value: string): string {
  return value.trim().toLowerCase();
}

export interface RateLimitKeys {
  pair: string;
  ip: string;
  account: string;
}

export function buildRateLimitKeys(ip: string, email: string): RateLimitKeys {
  const normIp = normalizeLoginIdentifier(ip);
  const normEmail = normalizeLoginIdentifier(email);
  return {
    pair: `pair:${normIp}|${normEmail}`,
    ip: `ip:${normIp}`,
    account: `acct:${normEmail}`,
  };
}

export interface RateLimitEntry {
  key: string;
  threshold: number;
}

export function rateLimitEntries(
  keys: RateLimitKeys,
  policy: RateLimitPolicy
): RateLimitEntry[] {
  return [
    { key: keys.pair, threshold: policy.maxFailuresPerPair },
    { key: keys.ip, threshold: policy.maxFailuresPerIp },
    { key: keys.account, threshold: policy.maxFailuresPerAccount },
  ];
}

export interface RateLimitCheck {
  blocked: boolean;
  retryAfterMs: number;
}

/** Storage backend so the request guard can be unit-tested with a fake. */
export interface RateLimitStore {
  check(entries: RateLimitEntry[], now: Date): Promise<RateLimitCheck>;
  recordFailures(entries: RateLimitEntry[], now: Date): Promise<void>;
  clear(keys: string[]): Promise<void>;
}

/**
 * PostgreSQL-backed store. Every method fails open (logs and degrades) so a
 * limiter outage never blocks legitimate sign-ins.
 */
export function createPgRateLimitStore(
  exec: RateLimitDb,
  policy: RateLimitPolicy = LOGIN_RATE_LIMIT_POLICY
): RateLimitStore {
  return {
    async check(entries, now) {
      if (entries.length === 0) return { blocked: false, retryAfterMs: 0 };
      try {
        const rows = await exec
          .select({ blockedUntil: loginRateLimits.blockedUntil })
          .from(loginRateLimits)
          .where(
            and(
              inArray(
                loginRateLimits.key,
                entries.map((e) => e.key)
              ),
              gt(loginRateLimits.blockedUntil, now)
            )
          );
        const retryAfterMs = rows.reduce(
          (max, row) =>
            Math.max(max, (row.blockedUntil?.getTime() ?? 0) - now.getTime()),
          0
        );
        return { blocked: rows.length > 0, retryAfterMs };
      } catch (error) {
        logStoreFailure("check", error);
        return { blocked: false, retryAfterMs: 0 };
      }
    },

    async recordFailures(entries, now) {
      if (entries.length === 0) return;
      // Timestamps are bound as ISO-Z strings inside raw SQL fragments so
      // they stay in the same UTC-wall frame as drizzle's own Date writes.
      const nowIso = now.toISOString();
      const windowStartCutoff = new Date(now.getTime() - policy.windowMs).toISOString();
      // Per-entry isolation (Phase 18): one unwritable key (e.g. a
      // pathological identifier that still exceeds a bound) must never
      // prevent the sibling keys of the same attempt from being counted.
      for (const entry of entries) {
        try {
          const [row] = await exec
            .insert(loginRateLimits)
            .values({
              key: entry.key,
              failCount: 1,
              windowStartedAt: now,
              blockedUntil: null,
            })
            .onConflictDoUpdate({
              target: loginRateLimits.key,
              set: {
                failCount: sql`CASE WHEN ${loginRateLimits.windowStartedAt} <= ${windowStartCutoff} THEN 1 ELSE ${loginRateLimits.failCount} + 1 END`,
                windowStartedAt: sql`CASE WHEN ${loginRateLimits.windowStartedAt} <= ${windowStartCutoff} THEN ${nowIso} ELSE ${loginRateLimits.windowStartedAt} END`,
              },
            })
            .returning({
              failCount: loginRateLimits.failCount,
            });
          if (row && row.failCount >= entry.threshold) {
            await exec
              .update(loginRateLimits)
              .set({ blockedUntil: new Date(now.getTime() + policy.blockMs) })
              .where(eq(loginRateLimits.key, entry.key));
          }
        } catch (error) {
          logStoreFailure(`record (${entry.key.slice(0, 16)}…)`, error);
        }
      }
      // Bounded growth: prune rows whose window has been idle for a day.
      try {
        await exec
          .delete(loginRateLimits)
          .where(
            lt(loginRateLimits.windowStartedAt, new Date(now.getTime() - RETENTION_MS))
          );
      } catch (error) {
        logStoreFailure("prune", error);
      }
    },

    async clear(keys) {
      if (keys.length === 0) return;
      try {
        await exec
          .delete(loginRateLimits)
          .where(inArray(loginRateLimits.key, keys));
      } catch (error) {
        logStoreFailure("clear", error);
      }
    },
  };
}

const CREDENTIALS_CALLBACK_PATH = "/api/auth/callback/credentials";

export function isCredentialsCallback(request: Request): boolean {
  if (request.method !== "POST") return false;
  try {
    return new URL(request.url).pathname === CREDENTIALS_CALLBACK_PATH;
  } catch {
    return false;
  }
}

/**
 * Validates and normalizes one forwarded-address token.
 * Returns null for anything that is not a literal IPv4/IPv6 address, so a
 * client-supplied garbage header can never mint an unbounded rate-limit key
 * (or a key PostgreSQL would reject at varchar(200)).
 */
function normalizeIpToken(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed || trimmed.length > 45) return null; // longest IPv6 form
  // IPv4-mapped IPv6 (::ffff:1.2.3.4) must share a key with plain IPv4.
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(trimmed);
  const candidate = mapped ? mapped[1] : trimmed;
  if (isIP(candidate) === 0) return null;
  return candidate;
}

export function extractClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // RIGHTMOST entry: the one appended by the nearest trusted proxy. Any
    // client-supplied prefix to its left is attacker-controlled and ignored.
    const hops = forwarded.split(",");
    for (let i = hops.length - 1; i >= 0; i--) {
      const normalized = normalizeIpToken(hops[i]);
      if (normalized) return normalized;
    }
    // Header present but no valid address anywhere — treat it as untrusted
    // and fall through to the proxy-set real IP, then the shared placeholder.
  }
  const real = normalizeIpToken(request.headers.get("x-real-ip") ?? "");
  if (real) return real;
  return "unknown";
}

export async function extractLoginEmail(request: Request): Promise<string | null> {
  try {
    const form = await request.clone().formData();
    const email = form.get("email");
    if (typeof email !== "string" || email.trim().length === 0) return null;
    // Too long to build storage-safe keys: treat as unparseable so the
    // attempt falls back to IP-only throttling (see MAX_EMAIL_KEY_LENGTH).
    if (normalizeLoginIdentifier(email).length > MAX_EMAIL_KEY_LENGTH) {
      return null;
    }
    return email;
  } catch {
    return null;
  }
}

function entriesForAttempt(
  ip: string,
  email: string | null,
  policy: RateLimitPolicy
): { entries: RateLimitEntry[]; keys: RateLimitKeys | null } {
  if (email && normalizeLoginIdentifier(email).length <= MAX_EMAIL_KEY_LENGTH) {
    const keys = buildRateLimitKeys(ip, email);
    return { entries: rateLimitEntries(keys, policy), keys };
  }
  // No parseable identifier (or one too long to store safely): throttle by
  // source IP only, so an unparseable body can never poison a shared account
  // key or produce a key PostgreSQL would reject at varchar(200).
  return {
    entries: [
      {
        key: `ip:${normalizeLoginIdentifier(ip)}`,
        threshold: policy.maxFailuresPerIp,
      },
    ],
    keys: null,
  };
}

export interface LoginAttempt {
  /** Absolute request URL — origin base for the throttled 429 redirect. */
  requestUrl: string;
  ip: string;
  email: string | null;
  entries: RateLimitEntry[];
  keys: RateLimitKeys | null;
}

/**
 * Must run BEFORE NextAuth reads the request body: after
 * `handlers.POST(request)` consumes the stream, `request.clone().formData()`
 * no longer yields the form fields. The route therefore parses the attempt
 * once and hands the same object to both the guard and the observer.
 * Returns null for anything that is not a credentials callback.
 */
export async function describeLoginAttempt(
  request: Request,
  policy: RateLimitPolicy = LOGIN_RATE_LIMIT_POLICY
): Promise<LoginAttempt | null> {
  if (!isCredentialsCallback(request)) return null;
  const email = await extractLoginEmail(request);
  const ip = extractClientIp(request);
  const { entries, keys } = entriesForAttempt(ip, email, policy);
  return { requestUrl: request.url, ip, email, entries, keys };
}

/**
 * Runs before NextAuth handles a credentials callback.
 * Returns a generic 429 response when the attempt is throttled, else null.
 */
export async function guardLoginAttempt(
  attempt: LoginAttempt | null,
  store: RateLimitStore
): Promise<Response | null> {
  if (!attempt) return null;
  // Fail-open at the guard itself too (Phase 18): the documented policy is
  // that limiter trouble never blocks sign-ins, and it must hold for ANY
  // store implementation, not only the PostgreSQL one.
  let decision: RateLimitCheck;
  try {
    decision = await store.check(attempt.entries, new Date());
  } catch (error) {
    logStoreFailure("guard check", error);
    return null;
  }
  if (!decision.blocked) return null;
  const retryAfterSec = Math.max(1, Math.ceil(decision.retryAfterMs / 1000));
  // Shape mirrors NextAuth's own redirect:false JSON so the existing login
  // client surfaces `error=RateLimited` instead of crashing on `new URL()`.
  const url = new URL("/login?error=RateLimited", attempt.requestUrl).toString();
  return Response.json(
    { url },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
  );
}

/**
 * Runs after NextAuth answered a credentials callback.
 *
 * Only an actual password failure (`error=CredentialsSignin`) increments
 * counters — CSRF/config errors are ignored so an attacker cannot inflate a
 * victim's account counter without valid CSRF tokens. A response without an
 * error means authentication succeeded and clears the attempt's keys.
 * Never throws: observation must not break the login flow.
 */
export async function observeLoginAttempt(
  attempt: LoginAttempt | null,
  response: Response,
  store: RateLimitStore
): Promise<void> {
  try {
    if (!attempt) return;
    if (response.status === 429) return; // our own guard response
    if (response.status >= 500) return; // server trouble is not a user failure

    let target: string | null = null;
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("json")) {
      const data = (await response
        .clone()
        .json()
        .catch(() => null)) as { url?: unknown } | null;
      if (data && typeof data.url === "string") target = data.url;
    }
    if (!target) target = response.headers.get("location");
    if (!target) return;

    let error: string | null = null;
    try {
      error = new URL(target, attempt.requestUrl).searchParams.get("error");
    } catch {
      return;
    }

    if (error === "CredentialsSignin") {
      await store.recordFailures(attempt.entries, new Date());
    } else if (!error && attempt.keys) {
      await store.clear(Object.values(attempt.keys));
    }
    // Any other error value (MissingCSRF, CallbackRouteError, …) is neither a
    // confirmed password failure nor a confirmed success: leave counters alone.
  } catch (error) {
    console.error("login rate-limit observation failed:", error);
  }
}
