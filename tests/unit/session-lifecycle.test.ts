// Phase 18: session-lifecycle verification against the INSTALLED Auth.js
// (@auth/core beta.32 via next-auth beta.32).
//
// Regression target: Phase 17 documented a 12-hour ABSOLUTE, non-sliding
// session. In this Auth.js version every `/api/auth/session` call re-encodes
// the JWT with `exp = now + maxAge` and re-sets the cookie, and `updateAge`
// only throttles the DATABASE strategy — so without an explicit claim check
// the session slides on every client refetch (SessionProvider mounts/focus).
// `enforceAbsoluteSession` pins the true sign-in time in the token and the
// jwt callback refuses tokens older than the absolute lifetime.
import { beforeAll, describe, expect, it } from "vitest";

process.env.AUTH_SECRET ??= "test-only-session-secret-not-a-real-secret";
process.env.AUTH_URL ??= "http://localhost:3000";

type Handlers = typeof import("@/lib/auth").handlers;

const SESSION_URL = "http://localhost:3000/api/auth/session";
const COOKIE_NAME = "authjs.session-token"; // http (non-secure) default

async function craftToken(payload: Record<string, unknown>): Promise<string> {
  const { encode } = await import("next-auth/jwt");
  return (await encode({
    token: payload,
    secret: process.env.AUTH_SECRET!,
    salt: COOKIE_NAME,
  })) as string;
}

async function getSession(
  handlers: Handlers,
  token: string
): Promise<{ status: number; body: unknown; cookies: string[] }> {
  const { NextRequest } = await import("next/server");
  const request = new NextRequest(SESSION_URL, {
    headers: { cookie: `${COOKIE_NAME}=${token}` },
  });
  const response = await handlers.GET(request);
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return {
    status: response.status,
    body,
    cookies: response.headers.getSetCookie(),
  };
}

describe("Auth.js session absolute lifetime", () => {
  let handlers: Handlers;

  beforeAll(async () => {
    ({ handlers } = await import("@/lib/auth"));
  });

  it("accepts a session issued within the absolute lifetime", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await craftToken({
      sub: "usr_001",
      name: "Anurag Yadav",
      email: "admin@medcore.com",
      role: "ADMIN",
      department: "Administration",
      authAt: now - 60 * 60, // signed in one hour ago
    });
    const result = await getSession(handlers, token);
    expect(result.status).toBe(200);
    const body = result.body as { user?: { email?: string; role?: string } } | null;
    expect(body?.user?.email).toBe("admin@medcore.com");
    expect(body?.user?.role).toBe("ADMIN");
  });

  it("rejects a session older than the absolute lifetime (non-sliding)", async () => {
    // The JWE itself is still valid (re-encoded `exp` slides — that is the
    // defect this guards against), but authAt is 13 hours old.
    const now = Math.floor(Date.now() / 1000);
    const token = await craftToken({
      sub: "usr_001",
      name: "Anurag Yadav",
      email: "admin@medcore.com",
      role: "ADMIN",
      department: "Administration",
      authAt: now - 13 * 60 * 60,
    });
    const result = await getSession(handlers, token);
    expect(result.status).toBe(200);
    expect(result.body).toBeNull();
    // The stale cookie is actively cleared by the server.
    expect(result.cookies.join("\n")).toContain(COOKIE_NAME);
  });

  it("stamps and honors the claim for tokens issued before the fix", async () => {
    // No authAt claim (a session minted before Phase 18): the jwt callback
    // must adopt the token's own issue time as the absolute start.
    const token = await craftToken({
      sub: "usr_003",
      name: "Nurse Emily Chen",
      email: "nurse@medcore.com",
      role: "NURSE",
      department: "Emergency",
      iat: Math.floor(Date.now() / 1000), // encode() stamps iat=now
    });
    const result = await getSession(handlers, token);
    const body = result.body as { user?: { role?: string } } | null;
    expect(body?.user?.role).toBe("NURSE");
  });

  it("survives repeated session refetches without extending an old session", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await craftToken({
      sub: "usr_001",
      email: "admin@medcore.com",
      role: "ADMIN",
      authAt: now - 13 * 60 * 60,
    });
    // Client SessionProvider refetches on focus — every refetch must still
    // refuse an absolutely-expired session.
    for (let i = 0; i < 3; i++) {
      const result = await getSession(handlers, token);
      expect(result.body).toBeNull();
    }
  });
});
