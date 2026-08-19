"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

/**
 * Fixed status rail along the foot of the screen.
 *
 * The reference site runs a section index down the right edge on wide screens
 * and folds it into a prev/next bar on narrow ones. This site has one page per
 * tool rather than ten sections of one page, so an index would be inventing
 * navigation that does not exist. The bar stays, and carries what is actually
 * true instead: where the work happens, and the time.
 *
 * The clock is read through useSyncExternalStore rather than useState plus
 * useEffect: the server has no meaningful "now", so it renders empty and React
 * fills it in after hydration without a mismatch or a setState-in-effect.
 */

function subscribe(onChange: () => void): () => void {
  const id = setInterval(onChange, 30_000);
  return () => clearInterval(id);
}

function currentTime(): string {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function StatusRail() {
  const time = useSyncExternalStore(subscribe, currentTime, () => "");

  return (
    <div className="rail">
      <Link href="/" className="shrink-0">
        <span aria-hidden="true" className="mr-2 text-accent">
          ▚
        </span>
        Index
      </Link>

      {/* Drops out below roughly 30rem rather than wrapping the rail onto two
          lines and eating the foot of the screen. */}
      <span className="hidden truncate sm:block">
        Local processing <span className="text-accent">|</span> no account{" "}
        <span className="text-accent">|</span> jpeg / png / webp / pdf
      </span>

      {/* suppressHydrationWarning: the server snapshot is intentionally empty. */}
      <span suppressHydrationWarning className="shrink-0 tabular-nums">
        {time}
      </span>
    </div>
  );
}
