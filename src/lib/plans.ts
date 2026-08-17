/**
 * Plans and entitlements.
 *
 * The guiding rule: **never gate the core promise.** "Compress this to 200 KB,
 * privately, for free" is why anyone shows up, and putting it behind a wall
 * would trade the whole product for a little revenue.
 *
 * So the free tier keeps every single-file browser tool unlimited — those cost
 * us literally nothing, since the user's own CPU does the work. What Pro sells
 * is the two things that genuinely have a cost or a ceiling:
 *
 *   1. Batch work — the power-user need, and the one that strains a tab.
 *   2. Office→PDF — the only feature that burns our money per use.
 *
 * That keeps the free tier honest rather than crippled, and means anyone paying
 * is paying for something real.
 */

export type PlanId = "free" | "pro";

export interface Plan {
  id: PlanId;
  name: string;
  /** Monthly price in minor units (cents). Zero for free. */
  priceCents: number;
  tagline: string;
  limits: PlanLimits;
  features: string[];
}

export interface PlanLimits {
  /** Files accepted in one batch operation (PDF merge, images→PDF). */
  batchFiles: number;
  /** Office→PDF conversions per rolling 24 hours. */
  officeConversionsPerDay: number;
  /** Whether photo presets can be saved for reuse. */
  savedPresets: boolean;
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    priceCents: 0,
    tagline: "Every browser tool, unlimited, forever.",
    limits: {
      batchFiles: 3,
      officeConversionsPerDay: 3,
      savedPresets: false,
    },
    features: [
      "Compress to an exact size — unlimited",
      "Passport & stamp photos — unlimited",
      "Crop, straighten, upscale, convert — unlimited",
      "Merge up to 3 files at a time",
      "3 Office→PDF conversions a day",
      "Files never leave your device",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceCents: 400,
    tagline: "For batch work and heavy document conversion.",
    limits: {
      batchFiles: 100,
      officeConversionsPerDay: 100,
      savedPresets: true,
    },
    features: [
      "Everything in Free",
      "Merge up to 100 files at a time",
      "100 Office→PDF conversions a day",
      "Save your own photo presets",
      "Support a tool that does not sell your files",
    ],
  },
};

export const DEFAULT_PLAN: PlanId = "free";

export function planOf(value: string | null | undefined): Plan {
  return value === "pro" ? PLANS.pro : PLANS.free;
}

export function limitsFor(planId: PlanId): PlanLimits {
  return PLANS[planId].limits;
}

export function formatPrice(cents: number): string {
  if (cents === 0) return "Free";
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Office→PDF is the one tool that costs us money per use, so it is the one
 * tool that requires an account — there is no reliable way to meter an
 * anonymous visitor, and an unmetered paid resource is an invitation.
 */
export const OFFICE_REQUIRES_ACCOUNT = true;
