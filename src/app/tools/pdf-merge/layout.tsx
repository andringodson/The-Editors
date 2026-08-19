import type { Metadata } from "next";

/*
 * The tool page itself is a client component and cannot export metadata, so it
 * lives here. Without a per-route title every page inherits the site default
 * and they all compete with each other in search results.
 */
export const metadata: Metadata = {
  title: "Merge PDF Files",
  description:
    "Combine any number of PDFs into one, reordering them first. Page counts are shown as you add files, and encrypted or damaged files are flagged before you merge.",
  keywords: ["merge pdf", "combine pdf files", "join pdf"],
  alternates: { canonical: "/tools/pdf-merge" },
  openGraph: {
    title: "Merge PDF Files — The Editors",
    description:
      "Combine any number of PDFs into one, reordering them first. Page counts are shown as you add files, and encrypted or damaged files are flagged before you merge.",
    url: "/tools/pdf-merge",
    type: "website",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
