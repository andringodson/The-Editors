import type { NextConfig } from "next";

/**
 * Security headers.
 *
 * This site's promise is that files stay on the user's device, and that promise
 * is only as strong as the guarantee no injected script can ship them
 * elsewhere. So `connect-src` is the header that matters most here.
 *
 * Advertising forces that open. Ad libraries load code from several Google
 * origins and phone home constantly, and there is no way to serve AdSense under
 * a `'self'`-only policy. The widening is therefore **conditional**: a
 * deployment with no publisher id configured keeps the strict policy, and only
 * one actually serving ads pays the cost. That way the tight version is not
 * quietly lost for everyone the moment ads are switched on somewhere.
 */

const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const adsEnabled = Boolean(process.env.NEXT_PUBLIC_ADSENSE_CLIENT);

const AD_SCRIPT_ORIGINS = [
  "https://pagead2.googlesyndication.com",
  "https://partner.googleadservices.com",
  "https://tpc.googlesyndication.com",
  "https://www.googletagservices.com",
  "https://adservice.google.com",
];

const AD_FRAME_ORIGINS = [
  "https://googleads.g.doubleclick.net",
  "https://tpc.googlesyndication.com",
  "https://www.google.com",
];

const AD_IMAGE_ORIGINS = [
  "https://*.googlesyndication.com",
  "https://*.doubleclick.net",
  "https://www.google.com",
  "https://*.g.doubleclick.net",
];

const AD_CONNECT_ORIGINS = [
  "https://pagead2.googlesyndication.com",
  "https://googleads.g.doubleclick.net",
  "https://*.googlesyndication.com",
];

function join(...parts: (string | string[])[]): string {
  return parts.flat().filter(Boolean).join(" ");
}

const contentSecurityPolicy = [
  "default-src 'self'",
  // Next injects inline bootstrap scripts; 'unsafe-inline' is required until
  // nonce-based CSP is wired through.
  join("script-src 'self' 'unsafe-inline'", adsEnabled ? AD_SCRIPT_ORIGINS : []),
  "style-src 'self' 'unsafe-inline'",
  // blob: and data: cover canvas output and object URLs, which is how every
  // result is previewed and downloaded.
  join("img-src 'self' blob: data:", adsEnabled ? AD_IMAGE_ORIGINS : []),
  "font-src 'self' data:",
  join(
    "connect-src 'self' blob: data:",
    supabaseOrigin,
    adsEnabled ? AD_CONNECT_ORIGINS : [],
  ),
  // Ads render inside iframes; without ads nothing may be framed at all.
  adsEnabled ? join("frame-src", AD_FRAME_ORIGINS) : "frame-src 'none'",
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
