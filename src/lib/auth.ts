import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import type { NextAuthRequest, Session } from "next-auth";
import type { Role } from "@/types/auth";
import { ROLES } from "@/types/auth";
import { db, users } from "./db";
import { recordAudit } from "./audit";
import {
  SESSION_AUTH_AT_CLAIM,
  SESSION_IDLE_TIMEOUT_SECONDS,
  SESSION_SID_CLAIM,
  sessionConfig,
  enforceAbsoluteSession,
} from "./session-config";
import { enforceSessionLiveness } from "./session-liveness";
import { logSessionActivityFailure, sweepStaleSessionActivity } from "./session-activity";
import { BCRYPT_COST } from "./password";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: Role;
      department: string;
      avatar?: string;
    };
    /** Phase 19: stable per-login session id (token `sid`) — keys activity state. */
    sessionId?: string;
    /** Phase 19: absolute sign-in time from the token (epoch seconds). */
    authAt?: number;
    /** Phase 19: effective idle window, surfaced for the client warning UX. */
    idleTimeoutSeconds?: number;
  }

  interface User {
    role: Role;
    department: string;
    avatar?: string;
  }
}

const VALID_ROLES = new Set<string>(Object.values(ROLES));

// Phase 25: timing equalizer for the credentials provider.
//
// The unknown-email path used to return null IMMEDIATELY while a known
// email with a wrong password paid a full bcrypt compare — reproduced live
// on POST /api/auth/callback/credentials as an 11.08x median latency gap
// (140.8ms known vs 12.7ms unknown, N=15, identical 302 responses): an
// unauthenticated account-enumeration oracle. Every non-empty attempt now
// pays exactly ONE bcrypt verify — real accounts against their stored hash,
// unknown accounts against a decoy hashed lazily with BCRYPT_COST (the same
// constant every hash writer uses, so the work factors cannot drift apart).
// Lazily hashed so importing this module costs nothing; the decoy is cached
// for the lifetime of the process.
let timingDecoyHash: string | undefined;

function getTimingDecoyHash(): string {
  timingDecoyHash ??= bcrypt.hashSync("phase25-timing-decoy", BCRYPT_COST);
  return timingDecoyHash;
}

/**
 * Verifies a credentials submission for the Credentials provider.
 * Returns the app user only after the bcrypt verify succeeds, else null.
 *
 * Exported for tests/unit/login-timing-equalizer.test.ts, which fails if the
 * decoy verify disappears: call-count parity between unknown-email and
 * known-email/wrong-password attempts is the invariant this fix exists to
 * keep (fail-on-revert).
 */
export async function verifyCredentials(credentials: unknown): Promise<{
  id: string;
  email: string;
  name: string;
  role: Role;
  department: string;
  avatar?: string;
} | null> {
  const input = credentials as { email?: unknown; password?: unknown } | null | undefined;
  if (!input?.email || !input?.password) return null;

  const email = input.email as string;
  const password = input.password as string;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!user) {
    // Phase 25: pay the same bcrypt cost as a real account before failing so
    // response timing cannot reveal whether the email exists (the DB lookup
    // itself is sub-millisecond in both cases).
    await bcrypt.compare(password, getTimingDecoyHash());
    return null;
  }

  if (!VALID_ROLES.has(user.role)) {
    console.error(`Invalid role "${user.role}" for user ${user.id}`);
    await recordAudit({
      actorId: user.id,
      action: "auth.login",
      entityType: "user",
      entityId: user.id,
      severity: "WARNING",
      category: "auth",
      success: false,
      metadata: { reason: "invalid_role" },
    });
    return null;
  }

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    await recordAudit({
      actorId: user.id,
      action: "auth.login",
      entityType: "user",
      entityId: user.id,
      severity: "WARNING",
      category: "auth",
      success: false,
      metadata: { reason: "invalid_credentials" },
    });
    return null;
  }

  await recordAudit({
    actorId: user.id,
    action: "auth.login",
    entityType: "user",
    entityId: user.id,
    severity: "INFO",
    category: "auth",
    success: true,
    metadata: null,
  });

  // Phase 19: opportunistically prune idle-state rows older than the
  // retention window (always longer than the absolute session lifetime, so
  // a live row can never be pruned). Best-effort — a pruning failure must
  // never block sign-in.
  try {
    await sweepStaleSessionActivity();
  } catch (error) {
    logSessionActivityFailure("sweep-on-login", error);
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as Role,
    department: user.department,
    avatar: user.avatar ?? undefined,
  };
}

const nextAuthInstance = NextAuth({
  // Explicit absolute session lifetime (12h, non-sliding) — see
  // src/lib/session-config.ts for the design rationale. The Phase 19 IDLE
  // timeout is enforced at the `auth()` boundary below, not here, so the
  // jwt/session callbacks stay free of database access.
  session: sessionConfig,
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: verifyCredentials,
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.department = user.department;
        token.avatar = user.avatar;
        // Absolute session start pinned at sign-in (see session-config).
        token.authAt = Math.floor(Date.now() / 1000);
      }
      // Phase 19: stable per-login session id for the shared idle state.
      // Auth.js's own `jti` is re-minted by encode() on every session
      // re-encode, so it changes on every poll — `sid` is stamped once and
      // persists for the life of this login. Stamping is pure (no I/O).
      if (!token[SESSION_SID_CLAIM]) {
        token[SESSION_SID_CLAIM] = globalThis.crypto.randomUUID();
      }
      // Phase 18: Auth.js refreshes JWT exp/cookie on every session call, so
      // the 12h absolute lifetime is enforced here — an expired token returns
      // null, which drops the session and clears the cookie.
      return enforceAbsoluteSession(token);
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        session.user.role = token.role as Role;
        session.user.department = token.department as string;
        session.user.avatar = token.avatar as string | undefined;
      }
      // Phase 19: internal fields consumed by the server-side liveness gate
      // (sid keys activity state, authAt seeds a missing row) and by the
      // client idle-warning UX (idleTimeoutSeconds is config, not state).
      session.sessionId = token[SESSION_SID_CLAIM] as string | undefined;
      session.authAt =
        typeof token[SESSION_AUTH_AT_CLAIM] === "number"
          ? token[SESSION_AUTH_AT_CLAIM]
          : undefined;
      session.idleTimeoutSeconds = SESSION_IDLE_TIMEOUT_SECONDS;
      return session;
    },
  },
});

export const { handlers, signIn, signOut } = nextAuthInstance;

type MiddlewareCallback = (
  req: NextAuthRequest
) => Response | void | Promise<Response | void>;

/**
 * Phase 19: the single enforcement boundary for session LIVENESS.
 *
 * Both call forms are preserved (87 data-path routes call `auth()`;
 * src/proxy.ts uses the middleware form) and both run
 * `enforceSessionLiveness` — idle window, user existence, and role
 * freshness — on top of Auth.js's pure JWT decoding. Keeping the check out
 * of the jwt callback itself preserves Phase 18's database-free lifetime
 * tests and gives one testable decision point (tests/unit/session-liveness).
 */
export function auth(): Promise<Session | null>;
export function auth(callback: MiddlewareCallback): unknown;
export function auth(callback?: MiddlewareCallback): unknown {
  if (typeof callback === "function") {
    return nextAuthInstance.auth(async (req: NextAuthRequest) => {
      req.auth = await enforceSessionLiveness(req.auth);
      return callback(req);
    });
  }
  return nextAuthInstance
    .auth()
    .then((session) => enforceSessionLiveness(session));
}
