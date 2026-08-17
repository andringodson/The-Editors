/**
 * Canonical site identity, used for metadata, sitemap and robots.
 *
 * Falls back through Vercel's system env so preview deployments describe
 * themselves correctly instead of all claiming to be production.
 */

export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_ENV === "production"
    ? "https://the-editors.vercel.app"
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

export const siteName = "The Editors";

export const siteTagline =
  "Image and document tools that run entirely in your browser";
