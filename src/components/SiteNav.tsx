"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { toolTint } from "@/lib/tools";

const MENU = [
  { slug: "compress", label: "Compress" },
  { slug: "passport", label: "Passport" },
  { slug: "crop", label: "Crop" },
  { slug: "pdf-merge", label: "PDF" },
];

/**
 * The tab bar.
 *
 * A client component for one reason: `aria-current` needs the current path, and
 * without it the nav gives no indication of where you are — the style for it
 * existed here long before anything set it.
 *
 * Each tab carries its tool's tint, so the rule under it is that tool's colour
 * rather than a single house accent. The nav then agrees with the landing grid
 * and with the page you land on, which is the whole point of the hue meaning
 * something.
 */
export default function SiteNav({
  accountHref,
  accountLabel,
}: {
  accountHref?: string;
  accountLabel?: string;
}) {
  const pathname = usePathname();

  return (
    <nav className="site-nav" aria-label="Tools">
      {MENU.map((item) => {
        const href = `/tools/${item.slug}`;
        return (
          <Link
            key={href}
            href={href}
            aria-current={pathname === href ? "page" : undefined}
            className={toolTint(item.slug)}
          >
            {item.label}
          </Link>
        );
      })}

      {accountHref ? (
        <Link
          href={accountHref}
          aria-current={pathname === accountHref ? "page" : undefined}
        >
          {accountLabel}
        </Link>
      ) : null}
    </nav>
  );
}
