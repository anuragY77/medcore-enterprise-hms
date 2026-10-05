// Phase 20: post-login redirect sanitizer (open-redirect fix).
//
// The login page pushed whatever `callbackUrl` query parameter it received.
// Next.js router.push() performs a HARD navigation for any URL whose origin
// differs from the app (next/dist/client/components/router-reducer/reducers/
// navigate-reducer.js: completeHardNavigation), so an attacker-crafted
// /login?callbackUrl=https://evil.example bounced a freshly authenticated
// user to an external site, and a javascript: URL would execute in the app
// origin. Only same-app absolute paths are allowed through.
import { describe, expect, it } from "vitest";
import { sanitizeCallbackUrl } from "@/lib/safe-redirect";

describe("sanitizeCallbackUrl (Phase 20 open-redirect fix)", () => {
  it("passes same-app paths through unchanged", () => {
    expect(sanitizeCallbackUrl("/")).toBe("/");
    expect(sanitizeCallbackUrl("/dashboard")).toBe("/dashboard");
    expect(sanitizeCallbackUrl("/patients?tab=1&x=2")).toBe("/patients?tab=1&x=2");
    expect(sanitizeCallbackUrl("/login?error=SessionExpired")).toBe(
      "/login?error=SessionExpired"
    );
    expect(sanitizeCallbackUrl("/appointments/APT-123")).toBe(
      "/appointments/APT-123"
    );
  });

  it("falls back to / for missing or empty values", () => {
    expect(sanitizeCallbackUrl(null)).toBe("/");
    expect(sanitizeCallbackUrl(undefined)).toBe("/");
    expect(sanitizeCallbackUrl("")).toBe("/");
  });

  it("rejects absolute URLs and javascript: schemes", () => {
    expect(sanitizeCallbackUrl("https://evil.example")).toBe("/");
    expect(sanitizeCallbackUrl("http://evil.example/phish")).toBe("/");
    expect(sanitizeCallbackUrl("javascript:alert(document.cookie)")).toBe("/");
    expect(sanitizeCallbackUrl("data:text/html,<script>1</script>")).toBe("/");
    expect(sanitizeCallbackUrl("evil.com/dashboard")).toBe("/");
  });

  it("rejects protocol-relative and backslash authority tricks", () => {
    // Browsers normalize \ to / inside URLs, so "/\evil" becomes "//evil".
    expect(sanitizeCallbackUrl("//evil.example")).toBe("/");
    expect(sanitizeCallbackUrl("/\\evil.example")).toBe("/");
    expect(sanitizeCallbackUrl("///evil.example")).toBe("/");
    expect(sanitizeCallbackUrl("/\\/evil.example")).toBe("/");
  });

  it("rejects control characters the URL parser would silently strip", () => {
    // WHATWG URL removes tab/LF/CR anywhere in the input, so "/<tab>/evil"
    // would parse as the protocol-relative "//evil" after stripping.
    expect(sanitizeCallbackUrl("/\t/evil.example")).toBe("/");
    expect(sanitizeCallbackUrl("/\n/evil.example")).toBe("/");
    expect(sanitizeCallbackUrl("/\r//evil.example")).toBe("/");
  });
});
