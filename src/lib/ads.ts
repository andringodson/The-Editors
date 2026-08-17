/**
 * Advertising configuration.
 *
 * Ads fund the site, which means they pay for the one thing that costs money —
 * the Office→PDF converter — and for everything else being free.
 *
 * Two positions this file encodes deliberately:
 *
 * 1. **Non-personalised by default.** Ads render without behavioural targeting
 *    until a visitor opts in. That earns less per impression. It is also the
 *    only setting consistent with a product whose entire pitch is that it does
 *    not take your data, and it keeps us lawful in the EEA/UK by default rather
 *    than by exception.
 *
 * 2. **Never inside a tool's working area.** Slots sit below the fold or beside
 *    content, never between a user and the thing they came to do. A misclick
 *    that interrupts someone's passport photo is worth less than the trust it
 *    costs.
 *
 * Like every other integration here, absent configuration is a no-op: with no
 * publisher id the slots render nothing and the site is unaffected.
 */

export const adsenseClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "";
export const isAdsConfigured = Boolean(adsenseClient);

/**
 * Named slots, so placement lives in one place rather than scattered as magic
 * numbers through the pages. Fill in the ids from your AdSense dashboard.
 */
export const AD_SLOTS = {
  toolFooter: process.env.NEXT_PUBLIC_ADSENSE_SLOT_TOOL_FOOTER ?? "",
  landingInline: process.env.NEXT_PUBLIC_ADSENSE_SLOT_LANDING ?? "",
} as const;

export type AdSlotName = keyof typeof AD_SLOTS;

export const CONSENT_STORAGE_KEY = "editors.ad-consent";

export type ConsentState = "unknown" | "personalised" | "basic";

export function readConsent(): ConsentState {
  if (typeof window === "undefined") return "unknown";
  const stored = window.localStorage.getItem(CONSENT_STORAGE_KEY);
  return stored === "personalised" || stored === "basic" ? stored : "unknown";
}

export function writeConsent(state: Exclude<ConsentState, "unknown">): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CONSENT_STORAGE_KEY, state);
}
