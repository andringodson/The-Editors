import type { Metadata } from "next";

/*
 * The tool page itself is a client component and cannot export metadata, so it
 * lives here. Without a per-route title every page inherits the site default
 * and they all compete with each other in search results.
 */
export const metadata: Metadata = {
  title: "Passport Photo Maker — Exact Sizes in mm",
  description:
    "Make a passport, visa, stamp or signature photo at official millimetre dimensions for India, the US, the UK, Schengen and China. 200–600 DPI, with an option to stay under portal upload limits.",
  keywords: [
    "passport size photo",
    "35x45 mm photo",
    "stamp size photo",
    "passport photo 20kb",
  ],
  alternates: { canonical: "/tools/passport" },
  openGraph: {
    title: "Passport Photo Maker — Exact Sizes in mm — The Editors",
    description:
      "Make a passport, visa, stamp or signature photo at official millimetre dimensions for India, the US, the UK, Schengen and China. 200–600 DPI, with an option to stay under portal upload limits.",
    url: "/tools/passport",
    type: "website",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
