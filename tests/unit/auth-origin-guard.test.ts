// Phase 23: cross-origin POST guard on /api/auth/[...nextauth].
//
// Auth.js (5.0.0-beta.32) issued a full session for credentials callbacks
// carrying a foreign Origin header (reproduced live: valid CSRF token +
// `Origin: https://evil.example` -> 302 + authjs.session-token + live
// session). The same-origin policy check that /api/auth/activity already
// performs was missing here. These tests fail if the guard is removed or
// weakened (e.g. trusting any Origin, or checking after the handler runs).
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const handlersCtl = vi.hoisted(() => ({
  postCalls: 0,
  getCalls: 0,
}));

vi.mock("@/lib/auth", () => ({
  handlers: {
    POST: vi.fn(async () => {
      handlersCtl.postCalls++;
      return new Response("handler-ok", { status: 200 });
    }),
    GET: vi.fn(async () => {
      handlersCtl.getCalls++;
      return new Response("handler-ok", { status: 200 });
    }),
  },
}));

vi.mock("@/lib/login-rate-limit", () => ({
  describeLoginAttempt: vi.fn(async () => ({ ip: "203.0.113.9", email: "a@b.test" })),
  guardLoginAttempt: vi.fn(async () => null),
  observeLoginAttempt: vi.fn(async () => undefined),
  createPgRateLimitStore: vi.fn(() => ({})),
}));

vi.mock("@/lib/session-liveness", () => ({
  enforceSessionLiveness: vi.fn(async () => true),
}));

vi.mock("@/lib/session-activity", () => ({
  tombstoneSessionActivity: vi.fn(async () => undefined),
  logSessionActivityFailure: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: {} }));

import { POST, GET } from "@/app/api/auth/[...nextauth]/route";
import { handlers } from "@/lib/auth";

const handlersPost = vi.mocked(handlers.POST);

type NextRequestInit = ConstructorParameters<
  typeof import("next/server").NextRequest
>[1];

async function callPost(headers: Record<string, string>): Promise<Response> {
  const { NextRequest } = await import("next/server");
  const request = new NextRequest(
    "http://localhost:3000/api/auth/callback/credentials",
    {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        host: "localhost:3000",
        ...headers,
      },
      body: "csrfToken=t&email=admin%40medcore.com&password=x",
      duplex: "half" as const,
    } as unknown as NextRequestInit
  );
  return POST(request);
}

describe("cross-origin POST guard on /api/auth (Phase 23)", () => {
  const originalAuthUrl = process.env.AUTH_URL;

  beforeEach(() => {
    vi.clearAllMocks();
    handlersCtl.postCalls = 0;
    delete process.env.AUTH_URL;
  });

  afterAll(() => {
    if (originalAuthUrl === undefined) delete process.env.AUTH_URL;
    else process.env.AUTH_URL = originalAuthUrl;
  });

  it("rejects a foreign Origin with 403 before the handler runs", async () => {
    const res = await callPost({ origin: "https://evil.example" });
    expect(res.status).toBe(403);
    expect(handlersCtl.postCalls).toBe(0);
    expect(handlersPost).not.toHaveBeenCalled();
  });

  it('rejects the literal "null" Origin with 403', async () => {
    const res = await callPost({ origin: "null" });
    expect(res.status).toBe(403);
    expect(handlersCtl.postCalls).toBe(0);
  });

  it("rejects an unparseable Origin with 403", async () => {
    const res = await callPost({ origin: "not a url" });
    expect(res.status).toBe(403);
    expect(handlersCtl.postCalls).toBe(0);
  });

  it("allows a same-origin Origin (no AUTH_URL)", async () => {
    const res = await callPost({ origin: "http://localhost:3000" });
    expect(res.status).toBe(200);
    expect(handlersCtl.postCalls).toBe(1);
  });

  it("allows a request with no Origin header (server-to-server)", async () => {
    const res = await callPost({});
    expect(res.status).toBe(200);
    expect(handlersCtl.postCalls).toBe(1);
  });

  it("allows AUTH_URL origin when configured, still rejects foreign", async () => {
    process.env.AUTH_URL = "https://medcore.example.com";
    const allowed = await callPost({ origin: "https://medcore.example.com" });
    expect(allowed.status).toBe(200);
    const rejected = await callPost({ origin: "http://localhost:3000" });
    expect(rejected.status).toBe(403);
    expect(handlersCtl.postCalls).toBe(1);
  });

  it("does not affect GET /api/auth/session", async () => {
    const { NextRequest } = await import("next/server");
    const request = new NextRequest("http://localhost:3000/api/auth/session", {
      headers: { origin: "https://evil.example" },
    });
    const res = await GET(request);
    expect(res.status).toBe(200);
  });
});
