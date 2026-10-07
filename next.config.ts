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
// Deliberately NOT set here (documented in the Phase 21/24 reports):
// - CSP script-src/default-src (see Phase 24 note below).
// - Phase 24 CSP (safe subset): frame-ancestors/object-src/base-uri/
//   form-action are enforced now — they never touch script/style loading,
//   so they cannot break the Next.js inline bootstrap. script-src and
//   default-src are deliberately omitted: a nonce pipeline would force every
//   page to dynamic rendering (the app's dashboard pages are build-time
//   prerendered shells behind the proxy auth gate), and framework inline
//   scripts are reported to ignore the request nonce on the Next 16.2.x line
//   (vercel/next.js#95433, auto-closed without a fix), which would break
//   hydration under enforcement. Revisit after those two blockers clear.
// - HSTS: the app is served over plain HTTP on localhost in dev/staging and
//   this config is shared across environments; enabling it locally would
//   pin browsers to HTTPS for localhost. Tracked for TLS termination.
const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
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
          {
            key: "Content-Security-Policy",
            value:
              "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
          },
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
