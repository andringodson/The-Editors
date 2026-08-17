import type { Metadata } from "next";

/*
 * The tool page itself is a client component and cannot export metadata, so it
 * lives here. Without a per-route title every page inherits the site default
 * and they all compete with each other in search results.
 */
export const metadata: Metadata = {
  title: "Convert JPG, PNG and WebP",
  description:
    "Convert between JPEG, PNG and WebP with a quality control. AVIF and HEIC are accepted as input. No upload, no queue, no watermark.",
  keywords: ["convert png to jpg","webp converter","heic to jpg"],
  alternates: { canonical: "/tools/format" },
  openGraph: {
    title: "Convert JPG, PNG and WebP — The Editors",
    description:
      "Convert between JPEG, PNG and WebP with a quality control. AVIF and HEIC are accepted as input. No upload, no queue, no watermark.",
    url: "/tools/format",
    type: "website",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
