"use client";

import { useEffect, useRef } from "react";
import { AD_SLOTS, adsenseClient, isAdsConfigured, type AdSlotName } from "@/lib/ads";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

interface AdSlotProps {
  name: AdSlotName;
  className?: string;
  /** Short line telling the reader why an ad is here. */
  label?: string;
}

/**
 * A single ad unit.
 *
 * Reserves its height before anything loads. An ad that appears and shoves the
 * page down is the single most irritating thing on the ad-supported web, and on
 * a tool site it can move a button out from under a user's cursor mid-task.
 */
export default function AdSlot({ name, className = "", label }: AdSlotProps) {
  const pushed = useRef(false);
  const slotId = AD_SLOTS[name];

  useEffect(() => {
    if (!isAdsConfigured || !slotId) return;
    // React 18+ runs effects twice in development; a second push on the same
    // <ins> makes AdSense throw.
    if (pushed.current) return;
    pushed.current = true;

    try {
      (window.adsbygoogle = window.adsbygoogle ?? []).push({});
    } catch {
      // A blocked or failed ad must never surface to the user.
    }
  }, [slotId]);

  if (!isAdsConfigured || !slotId) {
    // Placeholder in development so layout work reflects the real footprint.
    if (process.env.NODE_ENV === "development") {
      return (
        <div
          className={`flex min-h-[100px] items-center justify-center rounded-[var(--radius-base)] border border-dashed border-border text-xs text-muted ${className}`}
        >
          Ad slot: {name} (unconfigured)
        </div>
      );
    }
    return null;
  }

  return (
    <aside className={className} aria-label="Advertisement">
      {label ? (
        <p className="mb-1.5 text-xs text-muted">{label}</p>
      ) : null}
      <ins
        className="adsbygoogle block"
        style={{ display: "block", minHeight: 100 }}
        data-ad-client={adsenseClient}
        data-ad-slot={slotId}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}
