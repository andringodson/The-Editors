import Link from "next/link";

export const metadata = { title: "Offline" };

/**
 * Served by the service worker when a navigation fails and the requested page
 * is not cached. The tools listed here are all pure client-side computation, so
 * they genuinely work with no connection — this page exists to say so rather
 * than to apologise.
 */
export default function OfflinePage() {
  return (
    <div className="shell-prose bleed py-[var(--space-l)]">
      <div className="eyebrow">
        <span>
          Status <span className="sep">/</span> offline
        </span>
        <span>
          Seven tools <span className="sep">/</span> still working
        </span>
      </div>
      <h1 className="headline-sm">You&apos;re offline</h1>
      <p className="mt-3 text-muted text-pretty">
        That page hasn&apos;t been saved to this device yet. These tools have
        been, and they run entirely on your device — so they work right now,
        connection or not.
      </p>

      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {[
          { href: "/tools/compress", label: "Compress to a size" },
          { href: "/tools/passport", label: "Passport & stamp photos" },
          { href: "/tools/crop", label: "Crop & straighten" },
          { href: "/tools/pdf-merge", label: "Merge PDFs" },
        ].map((tool) => (
          <li key={tool.href}>
            <Link
              href={tool.href}
              className="block panel bg-panel px-4 py-3 font-medium no-underline hover:bg-accent-dim"
            >
              {tool.label}
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-sm text-muted">
        Office to PDF is the exception — it needs a server, so it will wait
        until you&apos;re back online.
      </p>
    </div>
  );
}
