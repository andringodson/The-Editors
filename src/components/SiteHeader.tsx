import Link from "next/link";
import { getCurrentUser } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const MENU = [
  { href: "/tools/compress", label: "Compress" },
  { href: "/tools/passport", label: "Passport" },
  { href: "/tools/crop", label: "Crop" },
  { href: "/tools/pdf-merge", label: "PDF" },
];

/**
 * Window title bar plus menu strip.
 *
 * The window controls are decoration — there is nothing to minimise — so they
 * are marked aria-hidden rather than rendered as buttons that lie to a screen
 * reader about what they do.
 */
export default async function SiteHeader() {
  const user = isSupabaseConfigured ? await getCurrentUser() : null;

  return (
    <header>
      <div className="win-title">
        <Link
          href="/"
          className="font-display text-base tracking-wide text-white no-underline"
        >
          The Editors
        </Link>

        <div className="win-controls" aria-hidden="true">
          <span className="win-control bevel-out">_</span>
          <span className="win-control bevel-out">□</span>
          <span className="win-control bevel-out">✕</span>
        </div>
      </div>

      <nav className="flex flex-wrap items-center gap-0.5 px-1 py-1">
        {MENU.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
          >
            {item.label}
          </Link>
        ))}

        <span className="flex-1" />

        {isSupabaseConfigured ? (
          <Link
            href={user ? "/account" : "/login"}
            className="btn-95 bevel-out px-3 text-sm"
          >
            {user ? "Account" : "Sign in"}
          </Link>
        ) : null}
      </nav>

      <div className="mx-1 h-0.5 bevel-in" />
    </header>
  );
}
