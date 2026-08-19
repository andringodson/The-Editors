"use client";

import { useEffect, useRef } from "react";
import {
  AD_SLOTS,
  adsenseClient,
  isAdsConfigured,
  type AdSlotName,
} from "@/lib/ads";

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
        <div className={`panel ${className}`}>
          <div className="panel-meta">
            <span>
              Ad slot <span className="text-accent">/</span> {name}
            </span>
            <span>Unconfigured</span>
          </div>
          <p className="label grid min-h-[100px] place-items-center outline-2 -outline-offset-8 outline-dashed outline-line">
            Placeholder
          </p>
        </div>
      );
    }
    return null;
  }

  return (
    <aside className={`panel ${className}`} aria-label="Advertisement">
      {/* Labelled in the panel corner like everything else on the grid, so an
          ad is visibly an ad rather than something that might be a tool. */}
      <div className="panel-meta">
        <span>{label ?? "Advertisement"}</span>
        <span>Sponsored</span>
      </div>
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
