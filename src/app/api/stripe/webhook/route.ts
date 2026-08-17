import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, stripeWebhookSecret } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe webhook — the only thing that may promote an account to Pro.
 *
 * Two non-negotiables:
 *
 *   1. The signature is verified against the raw body. Parsing first would
 *      break the check, and skipping it would let anyone grant themselves Pro
 *      with a single POST.
 *   2. Writes use the service-role key. The plan column must not be writable
 *      by the user it describes, so RLS denies it to everyone and only this
 *      route — running server-side with an elevated key — can change it.
 */

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function setPlan(
  userId: string,
  plan: "free" | "pro",
  fields: Record<string, string | null> = {},
) {
  const supabase = serviceClient();
  if (!supabase) return;

  await supabase
    .from("profiles")
    .update({ plan, updated_at: new Date().toISOString(), ...fields })
    .eq("id", userId);
}

async function setPlanByCustomer(customerId: string, plan: "free" | "pro") {
  const supabase = serviceClient();
  if (!supabase) return;

  await supabase
    .from("profiles")
    .update({ plan, updated_at: new Date().toISOString() })
    .eq("stripe_customer_id", customerId);
}

export async function POST(request: Request) {
  const stripe = getStripe();
  if (!stripe || !stripeWebhookSecret) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  // Raw text, not request.json() — the signature covers the exact bytes sent.
  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, stripeWebhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const userId = session.client_reference_id;
      if (userId) {
        await setPlan(userId, "pro", {
          stripe_customer_id:
            typeof session.customer === "string" ? session.customer : null,
          stripe_subscription_id:
            typeof session.subscription === "string" ? session.subscription : null,
        });
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object;
      const customerId =
        typeof subscription.customer === "string" ? subscription.customer : null;
      if (customerId) {
        // `past_due` still grants access — payment retries often succeed, and
        // cutting someone off mid-retry is a bad way to treat a paying user.
        const active = ["active", "trialing", "past_due"].includes(
          subscription.status,
        );
        await setPlanByCustomer(customerId, active ? "pro" : "free");
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      const customerId =
        typeof subscription.customer === "string" ? subscription.customer : null;
      if (customerId) await setPlanByCustomer(customerId, "free");
      break;
    }

    default:
      // Unhandled types are acknowledged, not errored — returning non-2xx makes
      // Stripe retry events we were never going to act on.
      break;
  }

  return NextResponse.json({ received: true });
}
