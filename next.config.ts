import type { NextConfig } from "next";

/**
 * Security headers.
 *
 * This site's whole promise is that files stay on the user's device. That
 * promise is only as strong as the guarantee that no injected script can ship
 * them somewhere — so the CSP restricts where anything may connect, and
 * `Permissions-Policy` switches off hardware the tools never use.
 *
 * `connect-src` allows Supabase (auth and telemetry) and nothing else. Adding a
 * third-party script later means widening this deliberately rather than by
 * accident.
 */

const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

const contentSecurityPolicy = [
  "default-src 'self'",
  // Next injects inline bootstrap scripts; 'unsafe-inline' is required until
  // nonce-based CSP is wired through.
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  // blob: and data: cover canvas output and object URLs, which is how every
  // result is previewed and downloaded.
  "img-src 'self' blob: data:",
  "font-src 'self' data:",
  `connect-src 'self' blob: data:${supabaseOrigin ? ` ${supabaseOrigin}` : ""}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
