import { NextResponse } from "next/server";
import { getStripe, isStripeConfigured, stripePriceId } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Starts a Stripe Checkout session for the signed-in user.
 *
 * `client_reference_id` carries our user id through to the webhook — it is the
 * only reliable way back from a completed payment to the account that made it,
 * since the Stripe customer is created by Checkout itself.
 */
export async function POST(request: Request) {
  const stripe = getStripe();
  if (!stripe || !isStripeConfigured) {
    return NextResponse.json(
      { error: "Checkout is not configured" },
      { status: 503 },
    );
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Accounts are unavailable" }, { status: 503 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  }

  const origin = new URL(request.url).origin;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: stripePriceId, quantity: 1 }],
      client_reference_id: user.id,
      customer_email: user.email,
      success_url: `${origin}/account?upgraded=1`,
      cancel_url: `${origin}/pricing`,
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url });
  } catch {
    return NextResponse.json({ error: "Could not start checkout" }, { status: 502 });
  }
}
