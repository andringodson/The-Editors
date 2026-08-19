import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Pixelify_Sans } from "next/font/google";
import Link from "next/link";
import AdScript from "@/components/AdScript";
import ConsentBanner from "@/components/ConsentBanner";
import FluidBackground from "@/components/FluidBackground";
import FluidSections from "@/components/FluidSections";
import ServiceWorker from "@/components/ServiceWorker";
import SiteHeader from "@/components/SiteHeader";
import StatusRail from "@/components/StatusRail";
import { siteName, siteTagline, siteUrl } from "@/lib/site";
import "./globals.css";

/*
 * Type system.
 *
 * Two faces, and only two. JetBrains Mono carries everything — interface, body
 * copy, labels, numbers — because a modular grid drawn in hairlines wants type
 * that sits on the same grid, and because a tool that reports dimensions and
 * byte counts is better served by figures of equal width.
 *
 * It is chosen over the obvious terminal faces for one reason: it was drawn for
 * long reading at small sizes. The tool pages carry real instructional copy,
 * and a bitmap face would make that copy a chore.
 *
 * Pixelify Sans does the display work, confined to headlines where its pixel
 * grid is legible.
 */

const mono = JetBrains_Mono({
  variable: "--font-mono-ui",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

const pixel = Pixelify_Sans({
  variable: "--font-pixel",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  // Required for the relative canonical and openGraph URLs in each tool's
  // route layout to resolve into absolute ones.
  metadataBase: new URL(siteUrl),
  title: {
    default: `${siteName} — ${siteTagline}`,
    template: `%s — ${siteName}`,
  },
  description:
    "Compress to an exact file size, make passport photos, merge PDFs and convert formats. Everything runs on your device; your files are never uploaded.",
  applicationName: siteName,
  alternates: { canonical: "/" },
  openGraph: {
    siteName,
    type: "website",
    locale: "en",
    url: "/",
  },
  twitter: { card: "summary_large_image" },
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  appleWebApp: {
    capable: true,
    title: "The Editors",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  // Matches the OLED base so the browser chrome disappears into the page.
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  // Never block pinch-zoom: people crop and inspect photos on phones.
  maximumScale: 5,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${mono.variable} ${pixel.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <FluidBackground />
        <FluidSections />
        <ServiceWorker />
        <AdScript />

        <SiteHeader />

        {/* Padding at the foot clears the fixed status rail. */}
        <main className="flex-1 pb-16">{children}</main>

        <footer className="bleed border-t border-line pb-16">
          <div className="shell flex flex-wrap items-baseline justify-between gap-2 py-[var(--space-s)]">
            <span className="label-tight">
              Files are processed on your device and never uploaded
            </span>
            <Link href="/privacy" className="label-tight hover:text-accent">
              Privacy &amp; ads →
            </Link>
          </div>
        </footer>

        <StatusRail />
        <ConsentBanner />
      </body>
    </html>
  );
}
