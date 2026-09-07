import type { Metadata } from "next";

/*
 * The tool page itself is a client component and cannot export metadata, so it
 * lives here. Without a per-route title every page inherits the site default
 * and they all compete with each other in search results.
 */

const description =
  "Enlarge a photo with Real-ESRGAN — an AI model that reconstructs edges and texture instead of stretching pixels. Up to 8K, free, and it runs entirely in your browser.";

export const metadata: Metadata = {
  title: "AI Image Upscaler — Enlarge to 4K and 8K",
  description,
  keywords: [
    "ai image upscaler",
    "real-esrgan online",
    "upscale image to 4k",
    "enlarge photo without losing quality",
    "increase image resolution",
  ],
  alternates: { canonical: "/tools/upscale" },
  openGraph: {
    title: "AI Image Upscaler — The Editors",
    description,
    url: "/tools/upscale",
    type: "website",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
