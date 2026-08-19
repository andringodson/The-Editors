import type { Metadata } from "next";

/*
 * The tool page itself is a client component and cannot export metadata, so it
 * lives here. Without a per-route title every page inherits the site default
 * and they all compete with each other in search results.
 */
export const metadata: Metadata = {
  title: "Crop and Straighten an Image",
  description:
    "Crop freehand or to a fixed ratio, and straighten a tilted scan before you cut. Works on phones and tablets. Your image never leaves the device.",
  keywords: ["crop image online", "straighten scanned photo", "crop to square"],
  alternates: { canonical: "/tools/crop" },
  openGraph: {
    title: "Crop and Straighten an Image — The Editors",
    description:
      "Crop freehand or to a fixed ratio, and straighten a tilted scan before you cut. Works on phones and tablets. Your image never leaves the device.",
    url: "/tools/crop",
    type: "website",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
