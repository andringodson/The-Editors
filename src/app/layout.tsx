import type { Metadata, Viewport } from "next";
import { Inter, Pixelify_Sans, VT323 } from "next/font/google";
import Link from "next/link";
import AdScript from "@/components/AdScript";
import ConsentBanner from "@/components/ConsentBanner";
import FluidBackground from "@/components/FluidBackground";
import ServiceWorker from "@/components/ServiceWorker";
import SiteHeader from "@/components/SiteHeader";
import Taskbar from "@/components/Taskbar";
import { siteName, siteTagline, siteUrl } from "@/lib/site";
import "./globals.css";

/*
 * Type system.
 *
 * Inter carries the interface. It is not period-accurate — Tahoma is — but
 * Tahoma is unavailable on most non-Windows devices and the fallback is worse
 * than a deliberate choice. Inter at 15px is legible everywhere.
 *
 * Pixelify Sans and VT323 do the era's talking: display headings and terminal
 * readouts respectively. Confined to those roles, since neither is comfortable
 * for body copy.
 */

const ui = Inter({
  variable: "--font-ui",
  subsets: ["latin"],
  display: "swap",
});

const pixel = Pixelify_Sans({
  variable: "--font-pixel",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
});

const terminal = VT323({
  variable: "--font-terminal",
  subsets: ["latin"],
  weight: "400",
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
      className={`${ui.variable} ${pixel.variable} ${terminal.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <FluidBackground />
        <ServiceWorker />
        <AdScript />

        {/* The desktop. Padding shrinks to nothing on phones, where a framed
            window inside a viewport-sized screen wastes real estate. */}
        {/* Generous desktop padding on larger screens so the backdrop is
            actually visible around the window — a floating window is the whole
            point of the metaphor. Phones get none; there the window is the
            screen. */}
        <div className="flex flex-1 flex-col p-0 pb-14 sm:p-6 sm:pb-20 lg:p-10 lg:pb-24">
          <div className="win bevel-out mx-auto flex w-full max-w-5xl flex-col">
            <SiteHeader />
            <main className="surface-violet flex-1">{children}</main>

            <footer className="mt-1 flex flex-wrap items-center justify-between gap-2 px-1 py-1 text-xs">
              <span className="bevel-in px-2 py-1 text-muted">
                Files are processed on your device and never uploaded.
              </span>
              <Link
                href="/privacy"
                className="bevel-in px-2 py-1 text-muted underline hover:text-foreground"
              >
                Privacy &amp; ads
              </Link>
            </footer>
          </div>
        </div>

        <Taskbar />
        <ConsentBanner />
      </body>
    </html>
  );
}
