import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { syncSubscription } from "@/lib/billing";
import { recordGearPurchase } from "@/lib/gear-billing";
import { requireEnv } from "@/lib/env";

export const runtime = "nodejs";

/** Keeps profiles.plan in sync with Stripe and delivers shop gear. Configure this URL in Stripe > Developers > Webhooks. */
export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(await req.text(), sig, requireEnv("STRIPE_WEBHOOK_SECRET"));
  } catch {
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        if (s.mode === "subscription" && s.subscription) {
          const sub = await stripe().subscriptions.retrieve(typeof s.subscription === "string" ? s.subscription : s.subscription.id);
          await syncSubscription(sub, s.client_reference_id);
        } else if (s.mode === "payment") {
          await recordGearPurchase(s, "webhook"); // shop gear; skips unpaid sessions, safe on retries
        }
        break;
      }
      case "checkout.session.async_payment_succeeded": {
        // A delayed payment method that settled after checkout (gear checkout is cards only; this is a safety net).
        const s = event.data.object as Stripe.Checkout.Session;
        if (s.mode === "payment") await recordGearPurchase(s, "webhook");
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncSubscription(event.data.object as Stripe.Subscription, null);
        break;
    }
  } catch (e) {
    console.error("stripe webhook failed", event.type, e);
    return NextResponse.json({ error: "handler failed" }, { status: 500 }); // Stripe retries
  }

  return NextResponse.json({ received: true });
}
