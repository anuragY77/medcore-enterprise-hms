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
//
// Deliberately NOT set here (documented in the Phase 21 report):
// - CSP: the app has no asset inventory/nonce pipeline yet; a wrong CSP
//   would silently break the dashboard. Tracked as follow-up hardening.
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
        ],
      },
    ];
  },
};

export default nextConfig;
