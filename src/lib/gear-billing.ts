import "server-only";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { admin } from "@/lib/supabase/admin";
import { parseGearMetadata } from "@/lib/avatar";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Gives the person the gear a paid one-time Checkout session bought. Safe to run more than once
 * (webhook retries plus the success page): rows already there are skipped. Returns rows added.
 * Throws on a database error so the webhook answers 500 and Stripe retries.
 */
export async function recordGearPurchase(session: Stripe.Checkout.Session): Promise<number> {
  if (session.mode !== "payment" || session.payment_status !== "paid") return 0;
  const userId = session.client_reference_id;
  if (!userId || !UUID.test(userId)) return 0;
  const items = parseGearMetadata(session.metadata?.gear);
  if (!items.length) return 0;
  const { data, error } = await admin()
    .from("user_gear")
    .upsert(
      items.map((item_id) => ({ user_id: userId, item_id, source: "shop" as const, stripe_session_id: session.id })),
      { onConflict: "user_id,item_id", ignoreDuplicates: true },
    )
    .select("item_id");
  if (error) throw error;
  return data?.length ?? 0;
}

/**
 * Backup for the webhook, run from the success page: asks Stripe about the session directly.
 * Records nothing unless the session belongs to this person and is paid. Never throws.
 */
export async function refreshGearPurchase(userId: string, sessionId: string): Promise<number> {
  if (!process.env.STRIPE_SECRET_KEY || !/^cs_[A-Za-z0-9_]{1,250}$/.test(sessionId)) return 0;
  try {
    const session = await stripe().checkout.sessions.retrieve(sessionId);
    if (session.client_reference_id !== userId || session.mode !== "payment" || session.payment_status !== "paid") return 0;
    return await recordGearPurchase(session);
  } catch (e) {
    console.error("refresh gear purchase failed", sessionId, e);
    return 0;
  }
}
