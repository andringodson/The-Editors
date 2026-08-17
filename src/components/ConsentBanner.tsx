"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  CONSENT_STORAGE_KEY,
  isAdsConfigured,
  readConsent,
  writeConsent,
  type ConsentState,
} from "@/lib/ads";

/**
 * Consent prompt for personalised advertising.
 *
 * Both choices carry equal visual weight. A banner where "accept" is a bright
 * button and "decline" is grey text is a dark pattern, and on a site whose
 * selling point is not taking your data it would be self-defeating.
 *
 * Declining is not a downgrade: ads still show, they are simply not targeted.
 * Nothing about the tools changes either way.
 *
 * NOTE: this is a plain consent prompt, not a Google-certified CMP. Serving
 * AdSense to EEA/UK traffic requires a certified one — see the README.
 */

function subscribe(onChange: () => void): () => void {
  // `storage` fires for other tabs; the custom event covers this one.
  window.addEventListener("storage", onChange);
  window.addEventListener("editors:consent", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("editors:consent", onChange);
  };
}

export default function ConsentBanner() {
  // useSyncExternalStore is the supported way to read browser-only state
  // without a setState-in-effect: the server snapshot is "unknown", and React
  // reconciles to the real value after hydration.
  const consent = useSyncExternalStore<ConsentState>(
    subscribe,
    readConsent,
    () => "unknown",
  );

  const choose = useCallback((state: "personalised" | "basic") => {
    writeConsent(state);
    window.dispatchEvent(new Event("editors:consent"));
    // Reload so the ad library re-initialises: it reads the flag once at
    // startup and cannot be reconfigured in place.
    window.location.reload();
  }, []);

  if (!isAdsConfigured || consent !== "unknown") return null;

  return (
    <div
      role="dialog"
      aria-label="Advertising preferences"
      data-testid="consent-banner"
      data-storage-key={CONSENT_STORAGE_KEY}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surface-raised p-4 shadow-lg"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-pretty">
          Ads keep this site free. May we let our advertising partner personalise
          them using cookies? Your files are never involved — they never leave
          your device either way.
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => choose("basic")}
            className="rounded-[var(--radius-base)] border border-border-strong px-4 py-2 text-sm font-medium transition-colors hover:border-accent"
          >
            No, keep it basic
          </button>
          <button
            type="button"
            onClick={() => choose("personalised")}
            className="rounded-[var(--radius-base)] border border-border-strong px-4 py-2 text-sm font-medium transition-colors hover:border-accent"
          >
            Yes, that&apos;s fine
          </button>
        </div>
      </div>
    </div>
  );
}
