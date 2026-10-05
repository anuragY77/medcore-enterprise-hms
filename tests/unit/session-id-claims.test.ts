// Phase 19: session identifier claims — the `sid` claim that keys shared
// PostgreSQL idle state.
//
// Why not Auth.js's `jti`: the installed encode() re-mints jti on EVERY
// re-encode (node_modules/@auth/core/jwt.js setJti(crypto.randomUUID())),
// and re-encoding happens on every /api/auth/session call — so jti changes
// on every poll and cannot key per-session state. `sid` is stamped once by
// the jwt callback and must survive re-encodes unchanged.
//
// Like session-lifecycle.test.ts, these tests run against the INSTALLED
// handlers with no database: the jwt/session callbacks stay pure (Phase 19
// liveness lives at the auth() boundary), which is exactly what makes this
// file possible without a DB.
import { beforeAll, describe, expect, it } from "vitest";

process.env.AUTH_SECRET ??= "test-only-session-secret-not-a-real-secret";
process.env.AUTH_URL ??= "http://localhost:3000";

type Handlers = typeof import("@/lib/auth").handlers;
type SessionBody = {
  user?: { email?: string };
  sessionId?: string;
  authAt?: number;
  idleTimeoutSeconds?: number;
} | null;

const SESSION_URL = "http://localhost:3000/api/auth/session";
const COOKIE_NAME = "authjs.session-token";

async function craftToken(payload: Record<string, unknown>): Promise<string> {
  const { encode } = await import("next-auth/jwt");
  return (await encode({
    token: payload,
    secret: process.env.AUTH_SECRET!,
    salt: COOKIE_NAME,
  })) as string;
}

async function decodeToken(jwe: string): Promise<Record<string, unknown>> {
  const { decode } = await import("next-auth/jwt");
  return (await decode({
    token: jwe,
    secret: process.env.AUTH_SECRET!,
    salt: COOKIE_NAME,
  })) as Record<string, unknown>;
}

async function getSession(
  handlers: Handlers,
  token: string
): Promise<{ status: number; body: SessionBody; cookies: string[] }> {
  const { NextRequest } = await import("next/server");
  const request = new NextRequest(SESSION_URL, {
    headers: { cookie: `${COOKIE_NAME}=${token}` },
  });
  const response = await handlers.GET(request);
  const text = await response.text();
  let body: SessionBody = null;
  try {
    body = text ? (JSON.parse(text) as SessionBody) : null;
  } catch {
    body = null;
  }
  return {
    status: response.status,
    body,
    cookies: response.headers.getSetCookie(),
  };
}

function cookieToken(cookies: string[]): string | null {
  for (const line of cookies) {
    if (line.startsWith(`${COOKIE_NAME}=`)) {
      const value = line.slice(COOKIE_NAME.length + 1).split(";")[0];
      return value === "" ? null : value;
    }
  }
  return null;
}

function validPayload(overrides: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  return {
    sub: "usr_001",
    name: "Anurag Yadav",
    email: "admin@medcore.com",
    role: "ADMIN",
    department: "Administration",
    authAt: now - 60,
    ...overrides,
  };
}

describe("session sid claim (Phase 19)", () => {
  let handlers: Handlers;

  beforeAll(async () => {
    ({ handlers } = await import("@/lib/auth"));
  });

  it("stamps a sid for tokens minted before Phase 19 and exposes it on the session", async () => {
    const result = await getSession(handlers, await craftToken(validPayload()));
    expect(result.status).toBe(200);
    expect(result.body).not.toBeNull();
    expect(typeof result.body?.sessionId).toBe("string");
    expect(result.body?.sessionId!.length).toBeGreaterThan(10);
    expect(result.body?.authAt).toBeGreaterThan(0);
    expect(typeof result.body?.idleTimeoutSeconds).toBe("number");
    expect(result.body?.idleTimeoutSeconds).toBeGreaterThan(0);
  });

  it("keeps the sid stable across re-encodes while Auth.js re-mints jti", async () => {
    const first = await getSession(
      handlers,
      await craftToken(validPayload())
    );
    const sidFromBody = first.body?.sessionId;
    expect(sidFromBody).toBeTruthy();

    // The response carries a re-encoded cookie (Phase 18 behavior): its
    // jti differs from what a later encode would produce, but sid must not.
    const refreshed = cookieToken(first.cookies);
    expect(refreshed).toBeTruthy();
    const decodedRefreshed = await decodeToken(refreshed!);
    expect(decodedRefreshed.sid).toBe(sidFromBody);

    // Second poll with the refreshed cookie: same sid again.
    const second = await getSession(handlers, refreshed!);
    expect(second.body?.sessionId).toBe(sidFromBody);
    const refreshedAgain = cookieToken(second.cookies);
    if (refreshedAgain) {
      const decoded = await decodeToken(refreshedAgain);
      expect(decoded.sid).toBe(sidFromBody);
    }
  });

  it("preserves a pre-existing sid instead of re-stamping it", async () => {
    const result = await getSession(
      handlers,
      await craftToken(validPayload({ sid: "fixed-sid-from-login" }))
    );
    expect(result.body?.sessionId).toBe("fixed-sid-from-login");
  });

  it("still rejects absolutely expired sessions regardless of sid", async () => {
    const now = Math.floor(Date.now() / 1000);
    const result = await getSession(
      handlers,
      await craftToken(validPayload({ authAt: now - 13 * 60 * 60 }))
    );
    expect(result.status).toBe(200);
    expect(result.body).toBeNull();
  });
});
