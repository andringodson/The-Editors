"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

/**
 * Fixed taskbar.
 *
 * The clock is read through useSyncExternalStore rather than useState +
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

export default function Taskbar() {
  const time = useSyncExternalStore(
    subscribe,
    currentTime,
    () => "",
  );

  return (
    <div className="win bevel-out fixed inset-x-0 bottom-0 z-40 flex items-center gap-1 px-1 py-1">
      <Link
        href="/"
        className="btn-95 bevel-out flex items-center gap-1.5 px-3 py-1 text-sm font-bold no-underline"
      >
        <span aria-hidden="true">▣</span>
        Start
      </Link>

      <Link
        href="/tools/compress"
        className="bevel-out hidden px-3 py-2 text-sm no-underline sm:block"
      >
        Compress
      </Link>
      <Link
        href="/tools/pdf-merge"
        className="bevel-out hidden px-3 py-2 text-sm no-underline sm:block"
      >
        Merge PDFs
      </Link>

      <span className="flex-1" />

      {/* suppressHydrationWarning: the server snapshot is intentionally empty. */}
      <span
        suppressHydrationWarning
        className="bevel-in min-w-[64px] px-2 py-1 text-center font-mono text-sm tabular-nums"
      >
        {time}
      </span>
    </div>
  );
}
