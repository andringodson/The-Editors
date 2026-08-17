import type { Metadata } from "next";

/*
 * The tool page itself is a client component and cannot export metadata, so it
 * lives here. Without a per-route title every page inherits the site default
 * and they all compete with each other in search results.
 */
export const metadata: Metadata = {
  title: "Convert Images to PDF",
  description:
    "Turn photos or scans into a single PDF, on A4 pages or sized to each image. Arrange the order before exporting. Everything happens on your device.",
  keywords: ["jpg to pdf","images to pdf","photos to pdf"],
  alternates: { canonical: "/tools/images-to-pdf" },
  openGraph: {
    title: "Convert Images to PDF — The Editors",
    description:
      "Turn photos or scans into a single PDF, on A4 pages or sized to each image. Arrange the order before exporting. Everything happens on your device.",
    url: "/tools/images-to-pdf",
    type: "website",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
