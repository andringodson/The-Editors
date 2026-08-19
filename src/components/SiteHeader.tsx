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
 * Site header — wordmark, navigation, and the one primary action.
 *
 * There is no hamburger, and that is a decision rather than an omission. Four
 * links wrap onto a second line on a narrow screen and stay visible; hiding
 * them behind a toggle would cost a tap, cost a client component on a page that
 * otherwise ships none, and buy nothing at this scale.
 */
export default async function SiteHeader() {
  const user = isSupabaseConfigured ? await getCurrentUser() : null;

  return (
    <header className="site-head">
      <div className="shell flex flex-wrap items-stretch justify-between gap-x-[var(--space-m)] gap-y-1 px-[var(--space-xs)]">
        <Link
          href="/"
          className="flex items-center gap-[var(--space-2xs)] py-[var(--space-2xs)] no-underline"
        >
          <span
            aria-hidden="true"
            className="grid size-4 shrink-0 place-items-center border border-accent text-[8px] leading-none text-accent"
          >
            ▚
          </span>
          <span className="label !tracking-[0.12em] text-foreground">
            the-editors
          </span>
        </Link>

        <nav className="site-nav" aria-label="Tools">
          {MENU.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
          {isSupabaseConfigured ? (
            <Link href={user ? "/account" : "/login"}>
              {user ? "Account" : "Sign in"}
            </Link>
          ) : null}
        </nav>
      </div>

      {/* The specification strip: what this is on the left, what it is made of
          on the right — the corner-metadata device applied to the whole page. */}
      <div className="border-t border-line">
        <div className="shell flex flex-wrap items-baseline justify-between gap-x-[var(--space-m)] gap-y-0 px-[var(--space-xs)] py-[var(--space-3xs)]">
          <span className="label-tight">
            Image + document tools <span className="text-accent">/</span> free
          </span>
          <span className="label-tight">
            Client-side <span className="text-accent">/</span> no upload
          </span>
        </div>
      </div>
    </header>
  );
}
