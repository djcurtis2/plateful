import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { stripe, periodEnd } from "@/lib/stripe";
import { admin } from "@/lib/supabase/admin";
import { requireEnv } from "@/lib/env";

export const runtime = "nodejs";

/** Keeps profiles.plan in sync with Stripe. Configure this URL in Stripe > Developers > Webhooks. */
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
        }
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

async function syncSubscription(sub: Stripe.Subscription, userIdHint: string | null) {
  const customer = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const userId = userIdHint ?? (sub.metadata?.user_id || null);
  const active = ["active", "trialing", "past_due"].includes(sub.status);

  const update = {
    plan: (active ? "plus" : "free") as "plus" | "free",
    subscription_status: sub.status,
    current_period_end: periodEnd(sub),
    stripe_customer_id: customer,
  };

  const db = admin();
  const q = userId ? db.from("profiles").update(update).eq("id", userId) : db.from("profiles").update(update).eq("stripe_customer_id", customer);
  const { error } = await q;
  if (error) throw error;
}
