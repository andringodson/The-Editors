import type { Metadata, Viewport } from "next";
import { Inter, Pixelify_Sans, VT323 } from "next/font/google";
import Link from "next/link";
import AdScript from "@/components/AdScript";
import ConsentBanner from "@/components/ConsentBanner";
import ServiceWorker from "@/components/ServiceWorker";
import SiteHeader from "@/components/SiteHeader";
import Taskbar from "@/components/Taskbar";
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
  title: {
    default: "The Editors — image and document tools that run in your browser",
    template: "%s — The Editors",
  },
  description:
    "Compress to an exact file size, make passport photos, merge PDFs and convert formats. Everything runs on your device; your files are never uploaded.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  appleWebApp: {
    capable: true,
    title: "The Editors",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0a8a8a" },
    { media: "(prefers-color-scheme: dark)", color: "#05494a" },
  ],
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
        <ServiceWorker />
        <AdScript />

        {/* The desktop. Padding shrinks to nothing on phones, where a framed
            window inside a viewport-sized screen wastes real estate. */}
        <div className="flex flex-1 flex-col p-0 pb-12 sm:p-4 sm:pb-16">
          <div className="win bevel-out mx-auto flex w-full max-w-5xl flex-1 flex-col">
            <SiteHeader />
            <main className="flex-1 bg-surface">{children}</main>

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
