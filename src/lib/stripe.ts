import Stripe from "stripe";

/**
 * Stripe configuration.
 *
 * Optional, like everything else that needs a third party: with no keys set the
 * pricing page still renders and explains that checkout is not connected. The
 * seven browser tools never depend on any of this.
 *
 * A note for whoever wires this up: Stripe leaves sales tax to you. For a
 * consumer product sold worldwide that means registering for VAT/GST in a
 * lengthening list of jurisdictions. A merchant of record — Paddle, Lemon
 * Squeezy — takes that on in exchange for a higher cut, and is usually the
 * saner choice for a solo developer. Swapping providers means replacing this
 * file and the two API routes; nothing else knows Stripe exists.
 */

const secretKey = process.env.STRIPE_SECRET_KEY;

export const stripePriceId = process.env.STRIPE_PRICE_ID ?? "";
export const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";

export const isStripeConfigured = Boolean(secretKey && stripePriceId);

let cached: Stripe | null = null;

export function getStripe(): Stripe | null {
  if (!secretKey) return null;
  if (!cached) {
    // Pinned deliberately: letting this float means a Stripe-side release can
    // change response shapes under a deploy that touched nothing.
    cached = new Stripe(secretKey, { apiVersion: "2026-07-29.dahlia" });
  }
  return cached;
}
