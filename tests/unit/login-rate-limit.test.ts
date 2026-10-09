import { describe, expect, it, vi } from "vitest";
import {
  LOGIN_RATE_LIMIT_POLICY,
  buildRateLimitKeys,
  describeLoginAttempt,
  extractClientIp,
  extractLoginEmail,
  guardLoginAttempt,
  isCredentialsCallback,
  isTransientStoreError,
  normalizeLoginIdentifier,
  observeLoginAttempt,
  rateLimitEntries,
  type RateLimitCheck,
  type RateLimitEntry,
  type RateLimitStore,
} from "@/lib/login-rate-limit";

const CALLBACK_URL = "http://localhost:3000/api/auth/callback/credentials";

function credentialsRequest(options?: {
  email?: string | null;
  ip?: string;
  url?: string;
}): Request {
  const body = new URLSearchParams();
  if (options?.email !== null) {
    body.set("email", options?.email ?? "Admin@MedCore.com");
  }
  body.set("password", "wrong-password");
  body.set("csrfToken", "test-csrf");
  const headers: Record<string, string> = {};
  if (options?.ip) headers["x-forwarded-for"] = options.ip;
  return new Request(options?.url ?? CALLBACK_URL, {
    method: "POST",
    headers,
    body,
  });
}

interface FakeStore extends RateLimitStore {
  checkCalls: RateLimitEntry[][];
  recordCalls: RateLimitEntry[][];
  clearCalls: string[][];
  checkResult: RateLimitCheck;
  throwOnAll: boolean;
}

function fakeStore(
  checkResult: RateLimitCheck = { blocked: false, retryAfterMs: 0 }
): FakeStore {
  const store: FakeStore = {
    checkCalls: [],
    recordCalls: [],
    clearCalls: [],
    checkResult,
    throwOnAll: false,
    async check(entries) {
      if (store.throwOnAll) throw new Error("store down");
      store.checkCalls.push(entries);
      return store.checkResult;
    },
    async recordFailures(entries) {
      if (store.throwOnAll) throw new Error("store down");
      store.recordCalls.push(entries);
    },
    async clear(keys) {
      if (store.throwOnAll) throw new Error("store down");
      store.clearCalls.push(keys);
    },
  };
  return store;
}

describe("normalizeLoginIdentifier / buildRateLimitKeys / rateLimitEntries", () => {
  it("trims and lowercases so key variants collide", () => {
    expect(normalizeLoginIdentifier("  Admin@MedCore.COM ")).toBe(
      "admin@medcore.com"
    );
  });

  it("builds pair, ip and account keys from normalized parts", () => {
    const keys = buildRateLimitKeys(" 10.0.0.1 ", "A@B.Com");
    expect(keys).toEqual({
      pair: "pair:10.0.0.1|a@b.com",
      ip: "ip:10.0.0.1",
      account: "acct:a@b.com",
    });
  });

  it("maps each key to its configured threshold (account > ip > pair)", () => {
    const keys = buildRateLimitKeys("1.2.3.4", "x@y.z");
    const entries = rateLimitEntries(keys, LOGIN_RATE_LIMIT_POLICY);
    const byKey = new Map(entries.map((e) => [e.key, e.threshold]));
    expect(byKey.get(keys.pair)).toBe(LOGIN_RATE_LIMIT_POLICY.maxFailuresPerPair);
    expect(byKey.get(keys.ip)).toBe(LOGIN_RATE_LIMIT_POLICY.maxFailuresPerIp);
    expect(byKey.get(keys.account)).toBe(
      LOGIN_RATE_LIMIT_POLICY.maxFailuresPerAccount
    );
    // Defense-in-depth ordering: a third party cannot cheaply lock an account.
    expect(LOGIN_RATE_LIMIT_POLICY.maxFailuresPerAccount).toBeGreaterThan(
      LOGIN_RATE_LIMIT_POLICY.maxFailuresPerPair
    );
    expect(LOGIN_RATE_LIMIT_POLICY.maxFailuresPerIp).toBeGreaterThan(
      LOGIN_RATE_LIMIT_POLICY.maxFailuresPerPair
    );
    // Blocks are temporary — never permanent.
    expect(LOGIN_RATE_LIMIT_POLICY.blockMs).toBeGreaterThan(0);
    expect(LOGIN_RATE_LIMIT_POLICY.blockMs).toBeLessThanOrEqual(60 * 60_000);
  });
});

describe("isCredentialsCallback", () => {
  it("matches only POST to the credentials callback path", () => {
    expect(isCredentialsCallback(credentialsRequest())).toBe(true);
    expect(
      isCredentialsCallback(
        credentialsRequest({ url: "http://localhost:3000/api/auth/session" })
      )
    ).toBe(false);
    expect(
      isCredentialsCallback(
        new Request(CALLBACK_URL, { method: "GET" })
      )
    ).toBe(false);
    expect(
      isCredentialsCallback(
        // A Request whose url cannot be parsed (defensive catch path).
        { method: "POST", url: "not a url" } as unknown as Request
      )
    ).toBe(false);
  });
});

describe("extractClientIp", () => {
  it("trusts the rightmost hop of x-forwarded-for (nearest proxy append)", () => {
    // Phase 18: the first entry is client-supplied in every topology —
    // behind a appending proxy the REAL address is the last one.
    const req = new Request(CALLBACK_URL, {
      method: "POST",
      headers: { "x-forwarded-for": " 203.0.113.5 , 10.0.0.1" },
    });
    expect(extractClientIp(req)).toBe("10.0.0.1");
  });

  it("ignores client-supplied garbage and uses the proxy-appended address", () => {
    const req = new Request(CALLBACK_URL, {
      method: "POST",
      headers: {
        "x-forwarded-for": "not-an-ip, <script>, 198.51.100.7",
      },
    });
    expect(extractClientIp(req)).toBe("198.51.100.7");
  });

  it("falls back to x-real-ip, then a stable placeholder", () => {
    const real = new Request(CALLBACK_URL, {
      method: "POST",
      headers: { "x-real-ip": "198.51.100.7" },
    });
    expect(extractClientIp(real)).toBe("198.51.100.7");
    expect(extractClientIp(new Request(CALLBACK_URL, { method: "POST" }))).toBe(
      "unknown"
    );
  });

  it("treats a header with no valid address as untrusted", () => {
    const req = new Request(CALLBACK_URL, {
      method: "POST",
      headers: {
        "x-forwarded-for": "9".repeat(500),
        "x-real-ip": "192.0.2.55",
      },
    });
    // The oversized token cannot become a key; the proxy real-IP still can.
    expect(extractClientIp(req)).toBe("192.0.2.55");
    const noFallback = new Request(CALLBACK_URL, {
      method: "POST",
      headers: { "x-forwarded-for": "definitely, not, an-ip" },
    });
    expect(extractClientIp(noFallback)).toBe("unknown");
  });

  it("normalizes IPv6 case and IPv4-mapped addresses onto one key", () => {
    const mapped = new Request(CALLBACK_URL, {
      method: "POST",
      headers: { "x-forwarded-for": "::FFFF:10.0.0.1" },
    });
    expect(extractClientIp(mapped)).toBe("10.0.0.1");
    const v6 = new Request(CALLBACK_URL, {
      method: "POST",
      headers: { "x-forwarded-for": "2001:DB8::1" },
    });
    expect(extractClientIp(v6)).toBe("2001:db8::1");
  });
});

describe("extractLoginEmail", () => {
  it("reads the email field from the cloned form body", async () => {
    await expect(extractLoginEmail(credentialsRequest())).resolves.toBe(
      "Admin@MedCore.com"
    );
  });

  it("returns null when the body is unparseable or the field is blank", async () => {
    const noEmail = credentialsRequest({ email: null });
    await expect(extractLoginEmail(noEmail)).resolves.toBeNull();

    const blank = credentialsRequest({ email: "   " });
    await expect(extractLoginEmail(blank)).resolves.toBeNull();
  });

  it("parses the email from a JSON body (no content-type bypass)", async () => {
    // Auth.js accepts application/json credentials callbacks. formData()
    // throws on that content type, so the parser must fall back to JSON —
    // otherwise a JSON login is keyed IP-only and skips the pair/account
    // tiers (Phase 26 finding, demonstrated live before the fix).
    const json = new Request(CALLBACK_URL, {
      method: "POST",
      body: JSON.stringify({ email: "a@b.c", password: "x" }),
      headers: { "content-type": "application/json" },
    });
    await expect(extractLoginEmail(json)).resolves.toBe("a@b.c");
  });

  it("returns null for JSON bodies without a usable email", async () => {
    const missing = new Request(CALLBACK_URL, {
      method: "POST",
      body: JSON.stringify({ password: "x" }),
      headers: { "content-type": "application/json" },
    });
    await expect(extractLoginEmail(missing)).resolves.toBeNull();

    const blank = new Request(CALLBACK_URL, {
      method: "POST",
      body: JSON.stringify({ email: "   " }),
      headers: { "content-type": "application/json" },
    });
    await expect(extractLoginEmail(blank)).resolves.toBeNull();

    const nonString = new Request(CALLBACK_URL, {
      method: "POST",
      body: JSON.stringify({ email: 42 }),
      headers: { "content-type": "application/json" },
    });
    await expect(extractLoginEmail(nonString)).resolves.toBeNull();

    const malformed = new Request(CALLBACK_URL, {
      method: "POST",
      body: "{not-json",
      headers: { "content-type": "application/json" },
    });
    await expect(extractLoginEmail(malformed)).resolves.toBeNull();

    const oversized = new Request(CALLBACK_URL, {
      method: "POST",
      body: JSON.stringify({ email: `${"a".repeat(300)}@evil.test` }),
      headers: { "content-type": "application/json" },
    });
    await expect(extractLoginEmail(oversized)).resolves.toBeNull();
  });

  it("does not consume the request body (clone)", async () => {
    const req = credentialsRequest();
    await extractLoginEmail(req);
    await expect(extractLoginEmail(req)).resolves.toBe("Admin@MedCore.com");
  });
});

describe("describeLoginAttempt", () => {
  it("bounds every key under the varchar(200) storage limit", async () => {
    // Phase 18: keys are stored in login_rate_limits.key varchar(200).
    // Unbounded inputs (oversized email field, garbage forwarded header)
    // must never produce a key that PostgreSQL would reject with 22001 —
    // a rejected insert would silently skip counting for the attempt.
    const longEmail = `${"a".repeat(240)}@evil.test`;
    const attempt = await describeLoginAttempt(
      credentialsRequest({ email: longEmail, ip: "9".repeat(500) })
    );
    expect(attempt).not.toBeNull();
    expect(attempt!.entries.length).toBeGreaterThan(0);
    for (const entry of attempt!.entries) {
      expect(entry.key.length).toBeLessThanOrEqual(200);
    }
  });

  it("falls back to IP-only counting for absurdly long identifiers", async () => {
    const longEmail = `${"b".repeat(300)}@evil.test`;
    const attempt = await describeLoginAttempt(
      credentialsRequest({ email: longEmail, ip: "192.0.2.44" })
    );
    // The account/pair keys cannot be stored, so the attempt is throttled
    // by source only — never by a poisoned or unwritable account key.
    expect(attempt!.email).toBeNull();
    expect(attempt!.entries.map((e) => e.key)).toEqual(["ip:192.0.2.44"]);
  });

  it("returns null for anything that is not a credentials callback", async () => {
    const session = new Request("http://localhost:3000/api/auth/session", {
      method: "POST",
    });
    expect(await describeLoginAttempt(session)).toBeNull();
  });

  it("extracts email, IP and all three keys while the body is unread", async () => {
    const attempt = await describeLoginAttempt(
      credentialsRequest({ ip: "203.0.113.9" })
    );
    expect(attempt).not.toBeNull();
    expect(attempt!.email).toBe("Admin@MedCore.com");
    expect(attempt!.ip).toBe("203.0.113.9");
    expect(attempt!.keys).not.toBeNull();
    expect(attempt!.entries).toHaveLength(3);
    expect(attempt!.requestUrl).toBe(CALLBACK_URL);
  });

  it("keeps the request body readable afterwards (single pre-parse contract)", async () => {
    // Regression: NextAuth consumes the body, so the email must be captured
    // ONCE before the handler runs and reused by the observer.
    const req = credentialsRequest();
    await describeLoginAttempt(req);
    // The clone inside describeLoginAttempt must not have consumed the
    // original — a second parse still succeeds (route-level guarantee).
    await expect(extractLoginEmail(req)).resolves.toBe("Admin@MedCore.com");
  });

  it("falls back to an IP-only attempt when the email is missing", async () => {
    const attempt = await describeLoginAttempt(
      credentialsRequest({ email: null, ip: "192.0.2.10" })
    );
    expect(attempt!.email).toBeNull();
    expect(attempt!.entries.map((e) => e.key)).toEqual(["ip:192.0.2.10"]);
    expect(attempt!.keys).toBeNull();
  });

  it("keys a JSON-body attempt in all three tiers (no content-type bypass)", async () => {
    // Phase 26 finding: application/json callbacks must not degrade to
    // IP-only counting — that would let an attacker keep the pair tier at
    // 5/15min and the account backstop at 30/15min by sending JSON bodies.
    const attempt = await describeLoginAttempt(
      new Request(CALLBACK_URL, {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "192.0.2.77" },
        body: JSON.stringify({ email: "Victim@MedCore.com", password: "x" }),
      })
    );
    expect(attempt!.email).toBe("Victim@MedCore.com");
    expect(attempt!.ip).toBe("192.0.2.77");
    expect(attempt!.entries.map((e) => e.key)).toEqual([
      "pair:192.0.2.77|victim@medcore.com",
      "ip:192.0.2.77",
      "acct:victim@medcore.com",
    ]);
  });
});

describe("guardLoginAttempt", () => {
  it("is a no-op when there is no credentials attempt", async () => {
    const store = fakeStore({ blocked: true, retryAfterMs: 60_000 });
    await expect(guardLoginAttempt(null, store)).resolves.toBeNull();
    expect(store.checkCalls).toHaveLength(0);
  });

  it("lets attempts through when the store says not blocked", async () => {
    const store = fakeStore({ blocked: false, retryAfterMs: 0 });
    const attempt = await describeLoginAttempt(credentialsRequest());
    await expect(guardLoginAttempt(attempt, store)).resolves.toBeNull();
    expect(store.checkCalls).toHaveLength(1);
    const keys = store.checkCalls[0].map((e) => e.key);
    expect(keys.some((k) => k.startsWith("pair:"))).toBe(true);
    expect(keys.some((k) => k.startsWith("ip:"))).toBe(true);
    expect(keys.some((k) => k.startsWith("acct:"))).toBe(true);
  });

  it("returns 429 with Retry-After and an absolute RateLimited URL when blocked", async () => {
    const store = fakeStore({ blocked: true, retryAfterMs: 41_000 });
    const attempt = await describeLoginAttempt(credentialsRequest());
    const res = await guardLoginAttempt(attempt, store);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(429);
    expect(res!.headers.get("Retry-After")).toBe("41");

    const body = (await res!.json()) as { url: string };
    // The next-auth client does `new URL(data.url)` — must be absolute and
    // must carry the error parameter the login page maps to a friendly message.
    const parsed = new URL(body.url);
    expect(parsed.origin).toBe("http://localhost:3000");
    expect(parsed.pathname).toBe("/login");
    expect(parsed.searchParams.get("error")).toBe("RateLimited");
  });

  it("throttles by IP only when the email cannot be parsed", async () => {
    const store = fakeStore({ blocked: true, retryAfterMs: 5_000 });
    const attempt = await describeLoginAttempt(
      credentialsRequest({ email: null, ip: "192.0.2.10" })
    );
    await guardLoginAttempt(attempt, store);
    expect(store.checkCalls[0].map((e) => e.key)).toEqual([
      "ip:192.0.2.10",
    ]);
  });
});

describe("observeLoginAttempt", () => {
  const failureResponse = () =>
    Response.json(
      { url: "http://localhost:3000/api/auth/callback/credentials?error=CredentialsSignin" },
      { status: 200 }
    );
  const successResponse = () =>
    Response.json({ url: "http://localhost:3000/" }, { status: 200 });
  const csrfResponse = () =>
    Response.json({ url: "http://localhost:3000/login?error=MissingCSRF" }, {
      status: 200,
    });

  it("records failures only for CredentialsSignin", async () => {
    const store = fakeStore();
    const attempt = await describeLoginAttempt(credentialsRequest());
    await observeLoginAttempt(attempt, failureResponse(), store);
    expect(store.recordCalls).toHaveLength(1);
    expect(store.recordCalls[0]).toHaveLength(3);
    expect(store.clearCalls).toHaveLength(0);
  });

  it("clears keys on a successful sign-in", async () => {
    const store = fakeStore();
    const attempt = await describeLoginAttempt(credentialsRequest());
    await observeLoginAttempt(attempt, successResponse(), store);
    expect(store.recordCalls).toHaveLength(0);
    expect(store.clearCalls).toHaveLength(1);
    expect(store.clearCalls[0].some((k) => k.startsWith("acct:"))).toBe(true);
  });

  it("ignores non-password errors so counters cannot be inflated without CSRF", async () => {
    const store = fakeStore();
    const attempt = await describeLoginAttempt(credentialsRequest());
    await observeLoginAttempt(attempt, csrfResponse(), store);
    expect(store.recordCalls).toHaveLength(0);
    expect(store.clearCalls).toHaveLength(0);
  });

  it("ignores 429 (its own guard) and 5xx responses", async () => {
    const store = fakeStore();
    const attempt = await describeLoginAttempt(credentialsRequest());
    const limited = Response.json({ url: "http://localhost:3000/login?error=RateLimited" }, { status: 429 });
    await observeLoginAttempt(attempt, limited, store);
    const crashed = new Response("boom", { status: 500 });
    await observeLoginAttempt(attempt, crashed, store);
    expect(store.recordCalls).toHaveLength(0);
    expect(store.clearCalls).toHaveLength(0);
  });

  it("does nothing without an attempt (not a credentials callback)", async () => {
    const store = fakeStore();
    await observeLoginAttempt(null, failureResponse(), store);
    expect(store.checkCalls).toHaveLength(0);
    expect(store.recordCalls).toHaveLength(0);
  });

  it("never throws, even when the store itself fails", async () => {
    const store = fakeStore();
    store.throwOnAll = true;
    const attempt = await describeLoginAttempt(credentialsRequest());
    // Observation swallows store failures...
    await expect(
      observeLoginAttempt(attempt, failureResponse(), store)
    ).resolves.toBeUndefined();
    // ...and the GUARD fails open too: a broken limiter must never turn a
    // sign-in attempt into a 500 (documented fail-open policy, enforced at
    // every layer — not only inside the PostgreSQL store).
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(guardLoginAttempt(attempt, store)).resolves.toBeNull();
      expect(errorSpy).toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });
});

describe("isTransientStoreError (fail-open classification)", () => {
  it("classifies connectivity and availability failures as transient", () => {
    expect(isTransientStoreError({ code: "ECONNREFUSED" })).toBe(true);
    expect(isTransientStoreError({ code: "ETIMEDOUT" })).toBe(true);
    expect(isTransientStoreError({ code: "57P01" })).toBe(true); // admin shutdown
    expect(isTransientStoreError({ code: "08006" })).toBe(true); // connection failure
    expect(isTransientStoreError({ code: "40001" })).toBe(true); // serialization
    expect(
      isTransientStoreError(new Error("Connection terminated due to timeout"))
    ).toBe(true);
  });

  it("flags programming/data defects as unexpected so they cannot hide as outages", () => {
    // 22001 = string_data_right_truncation (the Phase 18 key-overflow bug
    // class), 42P01 = undefined table, 23505 = unique violation.
    expect(isTransientStoreError({ code: "22001" })).toBe(false);
    expect(isTransientStoreError({ code: "42P01" })).toBe(false);
    expect(isTransientStoreError({ code: "23505" })).toBe(false);
    expect(isTransientStoreError(new TypeError("x is not a function"))).toBe(
      false
    );
    expect(isTransientStoreError("weird string")).toBe(false);
  });
});
