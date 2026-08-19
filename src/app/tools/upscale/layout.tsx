import type { Metadata } from "next";

/*
 * The tool page itself is a client component and cannot export metadata, so it
 * lives here. Without a per-route title every page inherits the site default
 * and they all compete with each other in search results.
 */
export const metadata: Metadata = {
  title: "Upscale an Image to 4K",
  description:
    "Enlarge a photo to Full HD, 2K, 4K or 8K with high-quality resampling. Free, unlimited, and processed entirely in your browser.",
  keywords: [
    "upscale image to 4k",
    "enlarge photo",
    "increase image resolution",
  ],
  alternates: { canonical: "/tools/upscale" },
  openGraph: {
    title: "Upscale an Image to 4K — The Editors",
    description:
      "Enlarge a photo to Full HD, 2K, 4K or 8K with high-quality resampling. Free, unlimited, and processed entirely in your browser.",
    url: "/tools/upscale",
    type: "website",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
