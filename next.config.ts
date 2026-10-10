import type { NextConfig } from "next";

// Phase 21 (production-readiness): baseline security headers.
//
// - nosniff: stops MIME sniffing of responses (drive-by script/style
//   injection via mislabelled uploads/resources).
// - X-Frame-Options DENY: the app is fully framed-attackable otherwise
//   (clickjacking of clinical forms); the UI embeds no frames itself.
// - Referrer-Policy: keep path/query of internal navigation off external
//   origins (patient identifiers appear in URLs).
// - Permissions-Policy: the app uses none of these sensors; deny explicitly.
// - X-XSS-Protection: 0 disables the legacy auditor, which is known to be
//   bypassable and can INTRODUCE XSS on older browsers (OWASP guidance).
// - poweredByHeader: false: stops advertising the framework version.
// - Cache-Control on /api: API responses carry PHI/financial data keyed by
//   session cookies; without an explicit directive a shared cache may store
//   them. Phase 22 live probe demonstrated the header was absent — no-store
//   forbids any storage beyond the browser's own memory.
//
// Deliberately NOT set here (documented in the Phase 21/24/28/29 reports):
// - CSP nonce pipeline: nonce-based CSP requires per-request HTML — every
//   route in this app is build-time prerendered (static shells behind the
//   proxy auth gate), which Next documents as incompatible with nonces;
//   maintainers closed vercel/next.js#95433 and #96063 as expected behavior
//   for static routes ("its HTML is generated before the per-request nonce
//   exists"). The framework-side blocker — boundary (loading/template/error)
//   chunk tags emitted without the nonce — was fixed upstream in
//   vercel/next.js#98398 (merged 2026-09-09, backported to the 16.3.x line;
//   `nonce: ctx.nonce` verified present in the installed 16.3.8 compiled
//   runtime). One blocker remains: converting the static shells to dynamic
//   rendering — an architectural decision, not a framework bug.
// - Phase 28 hardened the CSP from the safe subset to a restrictive default:
//   `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src
//   'self' 'unsafe-inline'` plus the existing safe subset. This is strictly
//   stronger than the Phase 24 policy (which left script/style/anything
//   unlisted open to ANY origin): 'unsafe-inline' keeps Next's inline
//   bootstrap hydrating while script-src still blocks cross-origin script
//   loads and blocks eval/new Function (no 'unsafe-eval'); style-src blocks
//   cross-origin stylesheets; default-src confines images/fonts/connect/
//   media/workers to same-origin (the app renders no <img>, self-hosts its
//   fonts via next/font, and makes only same-origin fetches — verified
//   against the built app with a browser console + securitypolicyviolation
//   listener across auth/dashboard/clinical/workflow pages, zero
//   violations). Zod v4's eval-based JIT probe would otherwise trip the
//   no-unsafe-eval rule on every page (a caught, swallowed, but still
//   reported securitypolicyviolation): src/lib/zod-csp.ts sets
//   `z.config({ jitless: true })` and is the first import of the root
//   layout and of every src/lib/validations module, so the probe is never
//   attempted. Dev adds ws:/wss: to connect-src so the HMR socket
//   survives default-src. Phase 29 re-verified the policy is emitted
//   exactly once with identical bytes on every route class (pages,
//   redirects, APIs, 404s, static assets — 76/76 raw-header checks). A
//   nonce remains the endgame once prerendered shells give way to dynamic
//   rendering (the only remaining blocker above).
// - HSTS: the app is served over plain HTTP on localhost in dev/staging and
//   this config is shared across environments; enabling it locally would
//   pin browsers to HTTPS for localhost. Tracked for TLS termination
//   (README "Security & Hardening" carries the exact header to set at the
//   reverse proxy).
const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    const connectSrc =
      process.env.NODE_ENV === "production"
        ? "connect-src 'self'"
        : "connect-src 'self' ws: wss:";
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      connectSrc,
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          { key: "X-XSS-Protection", value: "0" },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
};

export default nextConfig;
