import { describe, expect, it } from "vitest";
import {
  SESSION_AUTH_AT_CLAIM,
  SESSION_MAX_AGE_SECONDS,
  enforceAbsoluteSession,
  sessionConfig,
} from "@/lib/session-config";

describe("session configuration", () => {
  it("uses a JWT strategy with an explicit absolute lifetime", () => {
    expect(sessionConfig.strategy).toBe("jwt");
    expect(sessionConfig.maxAge).toBe(SESSION_MAX_AGE_SECONDS);
  });

  it("sets a 12-hour absolute session lifetime", () => {
    expect(SESSION_MAX_AGE_SECONDS).toBe(12 * 60 * 60);
    expect(SESSION_MAX_AGE_SECONDS).toBe(43_200);
  });

  it("is long enough for a clinical shift but under one day", () => {
    expect(sessionConfig.maxAge).toBeGreaterThanOrEqual(8 * 60 * 60);
    expect(sessionConfig.maxAge).toBeLessThanOrEqual(24 * 60 * 60);
  });
});

// Phase 18: `maxAge < updateAge` does NOT make JWT sessions absolute in the
// installed Auth.js — updateAge only throttles the database strategy, while
// every /api/auth/session call re-encodes the JWT with a fresh exp. The real
// control is enforceAbsoluteSession, unit-tested here and end-to-end against
// the installed handlers in tests/unit/session-lifecycle.test.ts.
describe("enforceAbsoluteSession", () => {
  const NOW = 1_700_000_000;

  it("accepts a token within the absolute lifetime", () => {
    const token = { sub: "usr_001", [SESSION_AUTH_AT_CLAIM]: NOW - 3600 };
    expect(enforceAbsoluteSession(token, NOW)).toBe(token);
  });

  it("rejects a token exactly at or beyond the absolute lifetime", () => {
    const atBoundary = {
      [SESSION_AUTH_AT_CLAIM]: NOW - SESSION_MAX_AGE_SECONDS,
    };
    expect(enforceAbsoluteSession(atBoundary, NOW)).toBeNull();
    const beyond = { [SESSION_AUTH_AT_CLAIM]: NOW - SESSION_MAX_AGE_SECONDS - 1 };
    expect(enforceAbsoluteSession(beyond, NOW)).toBeNull();
  });

  it("adopts the token iat for tokens minted before the claim existed", () => {
    const token: Record<string, unknown> = { sub: "usr_001", iat: NOW - 60 };
    const result = enforceAbsoluteSession(token, NOW);
    expect(result).toBe(token);
    expect(token[SESSION_AUTH_AT_CLAIM]).toBe(NOW - 60);
  });

  it("rejects a legacy token whose iat is already older than the lifetime", () => {
    const token = { sub: "usr_001", iat: NOW - SESSION_MAX_AGE_SECONDS - 10 };
    expect(enforceAbsoluteSession(token, NOW)).toBeNull();
  });

  it("treats a malformed claim as missing rather than trusting it", () => {
    const token = { iat: NOW - 5, [SESSION_AUTH_AT_CLAIM]: "yesterday" };
    const result = enforceAbsoluteSession(token, NOW);
    expect(result).toBe(token);
    // The bogus value is replaced by the token's own issue time.
    expect(token[SESSION_AUTH_AT_CLAIM]).toBe(NOW - 5);
  });
});
