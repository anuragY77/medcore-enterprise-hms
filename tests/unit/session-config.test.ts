import { describe, expect, it, vi } from "vitest";
import {
  SESSION_ACTIVITY_RETENTION_HOURS,
  SESSION_ACTIVITY_THROTTLE_SECONDS,
  SESSION_AUTH_AT_CLAIM,
  SESSION_IDLE_DEFAULT_MINUTES,
  SESSION_IDLE_MAX_MINUTES,
  SESSION_IDLE_MIN_MINUTES,
  SESSION_IDLE_TIMEOUT_SECONDS,
  SESSION_IDLE_WARNING_SECONDS_BEFORE,
  SESSION_MAX_AGE_SECONDS,
  SESSION_SID_CLAIM,
  activityPingIntervalSeconds,
  activityThrottleSeconds,
  enforceAbsoluteSession,
  idleWarningSecondsBefore,
  parseIdleTimeoutMinutes,
  resolveIdleTimeoutSeconds,
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

// Phase 19: server-side IDLE timeout configuration. The value is validated
// server-side only (never read from client input), falls back to a sane
// clinical default when unset or invalid, and is bounded so a typo cannot
// disable idle enforcement (0/empty) or leave sessions unattended for days.
describe("idle timeout configuration", () => {
  it("defaults to a 15-minute idle timeout when the variable is unset", () => {
    expect(SESSION_IDLE_DEFAULT_MINUTES).toBe(15);
    const parsed = parseIdleTimeoutMinutes(undefined);
    expect(parsed).toEqual({ ok: true, minutes: 15 });
    expect(resolveIdleTimeoutSeconds(undefined)).toBe(15 * 60);
  });

  it("treats an empty string as unset (default applies)", () => {
    expect(parseIdleTimeoutMinutes("")).toEqual({ ok: true, minutes: 15 });
    expect(parseIdleTimeoutMinutes("   ")).toEqual({ ok: true, minutes: 15 });
  });

  it("accepts a configured value inside the allowed range", () => {
    expect(parseIdleTimeoutMinutes("30")).toEqual({ ok: true, minutes: 30 });
    expect(resolveIdleTimeoutSeconds("30")).toBe(30 * 60);
    expect(parseIdleTimeoutMinutes("5")).toEqual({ ok: true, minutes: 5 });
    expect(parseIdleTimeoutMinutes("480")).toEqual({ ok: true, minutes: 480 });
  });

  it("trims surrounding whitespace before parsing", () => {
    expect(parseIdleTimeoutMinutes(" 10 ")).toEqual({ ok: true, minutes: 10 });
  });

  it("rejects values outside the allowed range", () => {
    expect(parseIdleTimeoutMinutes("0").ok).toBe(false);
    expect(parseIdleTimeoutMinutes("-5").ok).toBe(false);
    expect(parseIdleTimeoutMinutes("481").ok).toBe(false);
    expect(parseIdleTimeoutMinutes("10000").ok).toBe(false);
    // The bound blocks disabling enforcement (0/empty), not tight windows:
    // 1 minute is legal (also what browser tests configure).
    expect(SESSION_IDLE_MIN_MINUTES).toBe(1);
    expect(SESSION_IDLE_MAX_MINUTES).toBeLessThanOrEqual(480);
    expect(parseIdleTimeoutMinutes("1")).toEqual({ ok: true, minutes: 1 });
  });

  it("rejects non-integer and malformed values", () => {
    for (const bad of ["abc", "15.5", "1e3", "-1", "+10", "15m", "Infinity"]) {
      expect(parseIdleTimeoutMinutes(bad).ok).toBe(false);
    }
  });

  it("falls back to the default (with a warning) when the value is invalid", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      expect(resolveIdleTimeoutSeconds("not-a-number")).toBe(15 * 60);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain("SESSION_IDLE_TIMEOUT_MINUTES");
    } finally {
      warn.mockRestore();
    }
  });

  it("exports the effective idle timeout used by the app", () => {
    // Unset in the test environment → default. When an operator overrides
    // the variable (e.g. a short E2E timeout), this constant follows it.
    expect(SESSION_IDLE_TIMEOUT_SECONDS).toBeGreaterThan(0);
    expect(SESSION_IDLE_TIMEOUT_SECONDS).toBeLessThanOrEqual(
      SESSION_IDLE_MAX_MINUTES * 60
    );
  });
});

describe("idle activity recording constants", () => {
  it("throttles activity writes but keeps them well under the idle window", () => {
    expect(SESSION_ACTIVITY_THROTTLE_SECONDS).toBeGreaterThanOrEqual(5);
    expect(SESSION_ACTIVITY_THROTTLE_SECONDS).toBeLessThan(
      SESSION_IDLE_TIMEOUT_SECONDS
    );
  });

  // The safety property behind idle-proportional intervals: the client may
  // wait pingInterval between pings, and the store may skip a ping that
  // arrives inside its throttle window — worst-case staleness is their sum.
  // If that sum could reach the idle window, an ACTIVELY used session
  // (e.g. a 1-minute E2E timeout, or a tight operator config) would expire
  // mid-use. For every legal window the sum must stay strictly below idle.
  it("keeps worst-case activity staleness strictly below every legal idle window", () => {
    const legalMinutes = [1, 2, 5, 10, 15, 30, 60, 120, 480];
    for (const minutes of legalMinutes) {
      const idle = minutes * 60;
      const throttle = activityThrottleSeconds(idle);
      const ping = activityPingIntervalSeconds(idle);
      expect(throttle).toBeGreaterThanOrEqual(5);
      expect(throttle).toBeLessThanOrEqual(60);
      expect(ping).toBeGreaterThanOrEqual(5);
      expect(ping).toBeLessThanOrEqual(60);
      expect(throttle + ping).toBeLessThan(idle);
      expect(throttle + ping).toBeLessThanOrEqual(idle / 2);
    }
  });

  it("preserves the original 60s intervals for the 15-minute default", () => {
    expect(activityThrottleSeconds(15 * 60)).toBe(60);
    expect(activityPingIntervalSeconds(15 * 60)).toBe(60);
  });

  it("retains activity rows longer than the absolute session lifetime", () => {
    expect(SESSION_ACTIVITY_RETENTION_HOURS * 3600).toBeGreaterThan(
      SESSION_MAX_AGE_SECONDS
    );
  });

  it("warns 2 minutes before expiry for the default timeout, less for short ones", () => {
    expect(idleWarningSecondsBefore(15 * 60)).toBe(120);
    expect(idleWarningSecondsBefore(60)).toBe(12);
    expect(idleWarningSecondsBefore(SESSION_IDLE_TIMEOUT_SECONDS)).toBe(
      SESSION_IDLE_WARNING_SECONDS_BEFORE
    );
    // Never negative, never the whole window.
    expect(idleWarningSecondsBefore(1)).toBeGreaterThanOrEqual(1);
    expect(idleWarningSecondsBefore(900)).toBeLessThan(900);
  });
});

describe("session identifier claim", () => {
  it("uses a dedicated stable claim name (Auth.js jti changes every encode)", () => {
    expect(SESSION_SID_CLAIM).toBe("sid");
  });
});
