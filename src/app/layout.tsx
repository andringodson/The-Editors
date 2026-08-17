import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import ServiceWorker from "@/components/ServiceWorker";
import SiteHeader from "@/components/SiteHeader";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "The Editors — image and document tools that run in your browser",
    template: "%s — The Editors",
  },
  description:
    "Compress to an exact file size, make passport photos, merge PDFs and convert formats. Everything runs on your device; your files are never uploaded.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  appleWebApp: {
    capable: true,
    title: "The Editors",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  // Matches the surface colour in globals.css so the browser chrome does not
  // flash a mismatched bar on load.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfbfa" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0d" },
  ],
  width: "device-width",
  initialScale: 1,
  // Never block pinch-zoom: people crop and inspect photos on phones, and
  // locking scale would break that as well as failing accessibility guidance.
  maximumScale: 5,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ServiceWorker />
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-border py-6">
          <div className="mx-auto max-w-5xl px-4 text-sm text-muted">
            Files are processed on your device and never uploaded.
          </div>
        </footer>
      </body>
    </html>
  );
}
