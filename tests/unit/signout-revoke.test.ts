// Phase 20: sign-out revocation wiring in the auth route POST wrapper.
//
// Bug being guarded (reproduced intermittently by the Phase 20 E2E probes):
// Auth.js JWT sessions are stateless, so sign-out only clears the cookie —
// a concurrent GET /api/auth/session re-issues the still-valid token and
// that Set-Cookie can land AFTER the clear, resurrecting the logged-out
// session. The wrapper must tombstone the session's activity row (epoch
// last_activity + expired_logged) so the resurrected token fails the
// liveness gate on its very next request.
//
// The decision logic (which request, which response, which token) is pure,
// so auth handlers, rate limiting, and the store are mocked — the real
// database behavior of the tombstone is covered by the endpoint-guard
// integration test.
import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.AUTH_SECRET ??= "test-only-session-secret-not-a-real-secret";
process.env.AUTH_URL ??= "http://localhost:3000";

vi.mock("@/lib/auth", () => ({
  handlers: { GET: vi.fn(), POST: vi.fn() },
}));
vi.mock("@/lib/login-rate-limit", () => ({
  createPgRateLimitStore: vi.fn(() => ({})),
  describeLoginAttempt: vi.fn(),
  guardLoginAttempt: vi.fn(),
  observeLoginAttempt: vi.fn(),
  isTransientStoreError: vi.fn(() => false),
}));
vi.mock("@/lib/session-activity", () => ({
  recordSessionActivity: vi.fn(),
  checkSessionActivity: vi.fn(),
  markSessionExpiredLogged: vi.fn(),
  sweepStaleSessionActivity: vi.fn(),
  tombstoneSessionActivity: vi.fn(),
  logSessionActivityFailure: vi.fn(),
}));

import { handlers } from "@/lib/auth";
import { describeLoginAttempt } from "@/lib/login-rate-limit";
import {
  logSessionActivityFailure,
  tombstoneSessionActivity,
} from "@/lib/session-activity";
import { POST } from "@/app/api/auth/[...nextauth]/route";

const handlersPost = vi.mocked(handlers.POST);
const describeMock = vi.mocked(describeLoginAttempt);
const tombstoneMock = vi.mocked(tombstoneSessionActivity);
const logMock = vi.mocked(logSessionActivityFailure);

const SIGNOUT_URL = "http://localhost:3000/api/auth/signout";
const LEGACY_COOKIE = "authjs.session-token";
const SECURE_COOKIE = "__Secure-authjs.session-token";

async function craftToken(
  payload: Record<string, unknown>,
  salt: string = LEGACY_COOKIE
): Promise<string> {
  const { encode } = await import("next-auth/jwt");
  return (await encode({
    token: payload,
    secret: process.env.AUTH_SECRET!,
    salt,
  })) as string;
}

function handlerResponse(status: number, url = "http://localhost:3000/login") {
  return new Response(JSON.stringify({ url }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function post(options: {
  url?: string;
  cookie?: string | null;
  status?: number;
}): Promise<Response> {
  const { NextRequest } = await import("next/server");
  const request = new NextRequest(options.url ?? SIGNOUT_URL, {
    method: "POST",
    headers:
      options.cookie == null ? {} : { cookie: options.cookie },
  });
  return POST(request);
}

describe("POST /api/auth/signout revocation (Phase 20)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    describeMock.mockResolvedValue(null);
    handlersPost.mockResolvedValue(handlerResponse(200));
  });

  it("tombstones the session on a successful sign-out", async () => {
    const token = await craftToken({ sub: "usr_a", sid: "sid-signout-a" });
    const res = await post({ cookie: `${LEGACY_COOKIE}=${token}` });
    expect(res.status).toBe(200);
    expect(tombstoneMock).toHaveBeenCalledTimes(1);
    expect(tombstoneMock).toHaveBeenCalledWith({
      sid: "sid-signout-a",
      userId: "usr_a",
    });
    expect(logMock).not.toHaveBeenCalled();
  });

  it("tombstones using the __Secure- cookie (salt must match the cookie name)", async () => {
    const token = await craftToken(
      { sub: "usr_b", sid: "sid-signout-b" },
      SECURE_COOKIE
    );
    const res = await post({ cookie: `${SECURE_COOKIE}=${token}` });
    expect(res.status).toBe(200);
    expect(tombstoneMock).toHaveBeenCalledWith({
      sid: "sid-signout-b",
      userId: "usr_b",
    });
  });

  it("skips the tombstone when the sign-out was rejected (non-OK response)", async () => {
    handlersPost.mockResolvedValue(handlerResponse(403));
    const token = await craftToken({ sub: "usr_c", sid: "sid-signout-c" });
    const res = await post({ cookie: `${LEGACY_COOKIE}=${token}` });
    expect(res.status).toBe(403);
    expect(tombstoneMock).not.toHaveBeenCalled();
  });

  it("skips the tombstone on non-signout paths", async () => {
    const token = await craftToken({ sub: "usr_d", sid: "sid-signout-d" });
    const res = await post({
      url: "http://localhost:3000/api/auth/csrf",
      cookie: `${LEGACY_COOKIE}=${token}`,
    });
    expect(res.status).toBe(200);
    expect(tombstoneMock).not.toHaveBeenCalled();
  });

  it("skips the tombstone when no session cookie was presented", async () => {
    const res = await post({});
    expect(res.status).toBe(200);
    expect(tombstoneMock).not.toHaveBeenCalled();
    expect(logMock).not.toHaveBeenCalled();
  });

  it("ignores a garbage token without failing the sign-out response", async () => {
    const res = await post({ cookie: `${LEGACY_COOKIE}=not-a-jwe` });
    expect(res.status).toBe(200);
    expect(tombstoneMock).not.toHaveBeenCalled();
    // Best-effort: an undecodable token means there is nothing to revoke —
    // not a store failure worth logging.
    expect(logMock).not.toHaveBeenCalled();
  });

  it("ignores a valid token without a sid (pre-Phase-19 session)", async () => {
    const token = await craftToken({ sub: "usr_e" });
    const res = await post({ cookie: `${LEGACY_COOKIE}=${token}` });
    expect(res.status).toBe(200);
    expect(tombstoneMock).not.toHaveBeenCalled();
    expect(logMock).not.toHaveBeenCalled();
  });

  it("still returns the sign-out response when the store write fails (best-effort)", async () => {
    tombstoneMock.mockRejectedValueOnce(
      new Error("connect ECONNREFUSED store")
    );
    const token = await craftToken({ sub: "usr_f", sid: "sid-signout-f" });
    const res = await post({ cookie: `${LEGACY_COOKIE}=${token}` });
    expect(res.status).toBe(200);
    expect(logMock).toHaveBeenCalledTimes(1);
    expect(logMock.mock.calls[0][0]).toBe("signout-revoke");
    expect(logMock.mock.calls[0][2]).toBe("best-effort");
  });
});
