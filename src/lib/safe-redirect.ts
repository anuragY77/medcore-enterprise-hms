/**
 * Phase 20: post-login redirect sanitizer (open-redirect fix).
 *
 * The login page redirects to whatever `callbackUrl` query parameter it
 * receives after a successful sign-in. Next.js router.push() performs a
 * HARD navigation for any URL whose origin differs from the app
 * (router-reducer navigate-reducer.js -> completeHardNavigation), so an
 * attacker-crafted /login?callbackUrl=https://evil.example bounced a freshly
 * authenticated user to an external site - and a javascript: URL would
 * execute in the application origin.
 *
 * Only same-app absolute paths are allowed through:
 *  - must start with "/" (rejects https:, javascript:, bare host/path);
 *  - must not start with "//" or "/\\" (protocol-relative authority; browsers
 *    normalize "\" to "/" when parsing URLs);
 *  - control characters (tab/LF/CR and friends) are rejected outright
 *    because the WHATWG URL parser silently strips them, which could
 *    re-form "//" from a filtered string ("/<tab>/evil.example" parses as
 *    protocol-relative after the tab is removed).
 *
 * Every legitimate producer in the codebase (middleware, client redirects)
 * constructs path-only values, so none of them are affected.
 */
export function sanitizeCallbackUrl(raw: string | null | undefined): string {
  if (!raw) return "/";
  if (!raw.startsWith("/")) return "/";
  if (raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  for (let i = 0; i < raw.length; i++) {
    const code = raw.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return "/";
  }
  return raw;
}
