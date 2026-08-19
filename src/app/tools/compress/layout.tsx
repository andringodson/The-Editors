import type { Metadata } from "next";

/*
 * The tool page itself is a client component and cannot export metadata, so it
 * lives here. Without a per-route title every page inherits the site default
 * and they all compete with each other in search results.
 */
export const metadata: Metadata = {
  title: "Compress an Image to an Exact File Size",
  description:
    "Shrink a JPG, PNG or WebP to a size you name — 100 KB, 200 KB, 2 MB. Finds the best quality that fits under your target. Runs in your browser; nothing is uploaded.",
  keywords: [
    "compress image to 200kb",
    "reduce image size kb",
    "compress jpeg to 100kb",
  ],
  alternates: { canonical: "/tools/compress" },
  openGraph: {
    title: "Compress an Image to an Exact File Size — The Editors",
    description:
      "Shrink a JPG, PNG or WebP to a size you name — 100 KB, 200 KB, 2 MB. Finds the best quality that fits under your target. Runs in your browser; nothing is uploaded.",
    url: "/tools/compress",
    type: "website",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
