// Phase 20: /api/auth/activity ping endpoint security matrix.
//
// The route guards are pure decision logic (auth gate, Origin check,
// server-authoritative recording), so auth and the store are mocked to
// assert the decisions themselves — no database, no real session. The
// complementary end-to-end behavior (real cookie -> 401 after expiry) is
// covered by the external E2E harness and the endpoint-guard integration
// test.
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/session-activity", () => ({
  recordSessionActivity: vi.fn(),
  logSessionActivityFailure: vi.fn(),
}));

import { auth } from "@/lib/auth";
import {
  logSessionActivityFailure,
  recordSessionActivity,
} from "@/lib/session-activity";
import { POST } from "@/app/api/auth/activity/route";

// NextRequest's init type is undici's RequestInit (signal without null and
// a duplex requirement for request bodies), which does not match the global
// RequestInit exactly — build loosely and cast at the constructor.
type NextRequestInit = ConstructorParameters<
  typeof import("next/server").NextRequest
>[1];

const authMock = vi.mocked(auth);
const recordMock = vi.mocked(recordSessionActivity);
const logMock = vi.mocked(logSessionActivityFailure);

const SESSION = {
  user: {
    id: "usr_ping_1",
    name: "Ping User",
    email: "ping@medcore.test",
    role: "NURSE",
    department: "Emergency",
  },
  sessionId: "sid-ping-abc",
  authAt: 1_700_000_000,
  idleTimeoutSeconds: 60,
};

const SAVED_AUTH_URL = process.env.AUTH_URL;

async function ping(options: {
  session?: unknown;
  origin?: string | null;
  body?: string;
  url?: string;
}) {
  const { NextRequest } = await import("next/server");
  const headers: Record<string, string> = {};
  if (options.origin !== null && options.origin !== undefined) {
    headers.origin = options.origin;
  }
  authMock.mockResolvedValue(
    (options.session ?? null) as Awaited<ReturnType<typeof auth>>
  );
  const init = {
    method: "POST",
    headers,
    ...(options.body !== undefined
      ? { body: options.body, duplex: "half" as const }
      : {}),
  } as unknown as NextRequestInit;
  const request = new NextRequest(
    options.url ?? "http://localhost:3000/api/auth/activity",
    init
  );
  return POST(request);
}

describe("POST /api/auth/activity (Phase 20)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AUTH_URL = "http://localhost:3000";
  });

  afterAll(() => {
    if (SAVED_AUTH_URL === undefined) delete process.env.AUTH_URL;
    else process.env.AUTH_URL = SAVED_AUTH_URL;
  });

  it("returns 401 without a session and records nothing", async () => {
    const res = await ping({ session: null });
    expect(res.status).toBe(401);
    expect(recordMock).not.toHaveBeenCalled();
  });

  it("returns 401 when the session has no sid and records nothing", async () => {
    const res = await ping({ session: { ...SESSION, sessionId: undefined } });
    expect(res.status).toBe(401);
    expect(recordMock).not.toHaveBeenCalled();
  });

  it("records with the SERVER session values and acknowledges 204 (no Origin header)", async () => {
    const res = await ping({ session: SESSION });
    expect(res.status).toBe(204);
    expect(recordMock).toHaveBeenCalledTimes(1);
    expect(recordMock).toHaveBeenCalledWith({
      sid: "sid-ping-abc",
      userId: "usr_ping_1",
    });
  });

  it("accepts a matching Origin", async () => {
    const res = await ping({ session: SESSION, origin: "http://localhost:3000" });
    expect(res.status).toBe(204);
    expect(recordMock).toHaveBeenCalledTimes(1);
  });

  it("rejects a foreign Origin with 403 before any write", async () => {
    const res = await ping({ session: SESSION, origin: "https://evil.example" });
    expect(res.status).toBe(403);
    expect(recordMock).not.toHaveBeenCalled();
  });

  it('rejects the opaque Origin "null" with 403', async () => {
    const res = await ping({ session: SESSION, origin: "null" });
    expect(res.status).toBe(403);
    expect(recordMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed Origin with 403", async () => {
    const res = await ping({ session: SESSION, origin: "not a url" });
    expect(res.status).toBe(403);
    expect(recordMock).not.toHaveBeenCalled();
  });

  it("compares against AUTH_URL, not the request host", async () => {
    // AUTH_URL is pinned to localhost:3000 while the request arrives from a
    // different host whose own origin matches the Origin header — pinning
    // must win and reject. (Note: NextRequest rewrites loopback IPs to
    // localhost, so a stable non-loopback host is used here.)
    const res = await ping({
      session: SESSION,
      origin: "http://app.test",
      url: "http://app.test/api/auth/activity",
    });
    expect(res.status).toBe(403);
    expect(recordMock).not.toHaveBeenCalled();
  });

  it("falls back to the request URL origin when AUTH_URL is unset", async () => {
    delete process.env.AUTH_URL;
    const res = await ping({
      session: SESSION,
      origin: "http://app.test",
      url: "http://app.test/api/auth/activity",
    });
    expect(res.status).toBe(204);
    expect(recordMock).toHaveBeenCalledWith({
      sid: "sid-ping-abc",
      userId: "usr_ping_1",
    });
  });

  it("ignores a forged body entirely (server stamps its own identity/time)", async () => {
    const res = await ping({
      session: SESSION,
      origin: "http://localhost:3000",
      body: JSON.stringify({
        sid: "attacker-chosen-sid",
        userId: "attacker-chosen-user",
        timestamp: 0,
        lastActivity: "1970-01-01T00:00:00Z",
      }),
    });
    expect(res.status).toBe(204);
    expect(recordMock).toHaveBeenCalledTimes(1);
    expect(recordMock).toHaveBeenCalledWith({
      sid: "sid-ping-abc",
      userId: "usr_ping_1",
    });
  });

  it("still acknowledges 204 when the store write fails, with a logged failure", async () => {
    recordMock.mockRejectedValueOnce(new Error("store down"));
    const res = await ping({ session: SESSION });
    expect(res.status).toBe(204);
    expect(logMock).toHaveBeenCalledTimes(1);
    expect(logMock.mock.calls[0][0]).toBe("record:ping");
  });

  it("exports POST only (no GET handler to hijack)", async () => {
    const mod = await import("@/app/api/auth/activity/route");
    expect(typeof mod.POST).toBe("function");
    expect("GET" in mod).toBe(false);
  });
});
