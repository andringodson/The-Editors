import type { Metadata } from "next";

/*
 * The tool page itself is a client component and cannot export metadata, so it
 * lives here. Without a per-route title every page inherits the site default
 * and they all compete with each other in search results.
 */
export const metadata: Metadata = {
  title: "Convert PowerPoint, Word and Excel to PDF",
  description:
    "Convert PPT, PPTX, DOC, DOCX, XLS and XLSX to PDF with LibreOffice. The one tool here that uses a server — your file is deleted the moment the PDF is returned.",
  keywords: ["ppt to pdf","word to pdf","excel to pdf"],
  alternates: { canonical: "/tools/office-to-pdf" },
  openGraph: {
    title: "Convert PowerPoint, Word and Excel to PDF — The Editors",
    description:
      "Convert PPT, PPTX, DOC, DOCX, XLS and XLSX to PDF with LibreOffice. The one tool here that uses a server — your file is deleted the moment the PDF is returned.",
    url: "/tools/office-to-pdf",
    type: "website",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
