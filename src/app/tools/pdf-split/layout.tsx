import type { Metadata } from "next";

/*
 * The tool page itself is a client component and cannot export metadata, so it
 * lives here. Without a per-route title every page inherits the site default
 * and they all compete with each other in search results.
 */

const description =
  "Extract a page range from a PDF, or delete the pages you do not want. Runs entirely in your browser — the file is never uploaded.";

export const metadata: Metadata = {
  title: "Split PDF and Delete Pages",
  description,
  keywords: [
    "split pdf",
    "extract pdf pages",
    "delete pages from pdf",
    "remove pages from pdf",
    "pdf page extractor",
  ],
  alternates: { canonical: "/tools/pdf-split" },
  openGraph: {
    title: "Split PDF and Delete Pages — The Editors",
    description,
    url: "/tools/pdf-split",
    type: "website",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
