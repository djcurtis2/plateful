import "server-only";
import type Stripe from "stripe";
import { stripe, periodEnd } from "@/lib/stripe";
import { admin } from "@/lib/supabase/admin";

/** Copies a Stripe subscription's status onto the person's profile (plan, status, renewal date). */
export async function syncSubscription(sub: Stripe.Subscription, userIdHint: string | null) {
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

/**
 * Asks Stripe directly whether this customer has a live subscription and updates the profile.
 * Backup for the webhook: if it was missed (e.g. `stripe listen` not running locally), Plus still turns on
 * when the person lands back on the site. Returns true if anything was synced.
 */
export async function refreshFromStripe(userId: string, customerId: string | null | undefined): Promise<boolean> {
  if (!customerId || !process.env.STRIPE_SECRET_KEY) return false;
  try {
    const subs = await stripe().subscriptions.list({ customer: customerId, status: "all", limit: 5 });
    const live = subs.data.find((s) => ["active", "trialing", "past_due"].includes(s.status)) ?? subs.data[0];
    if (!live) return false;
    await syncSubscription(live, userId);
    return true;
  } catch (e) {
    console.error("refresh from Stripe failed", e);
    return false;
  }
}
