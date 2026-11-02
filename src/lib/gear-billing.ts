import "server-only";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { admin } from "@/lib/supabase/admin";
import { parseGearMetadata } from "@/lib/avatar";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Postgres foreign key violation: the profile (and auth user) behind the session no longer exists. */
const FK_VIOLATION = "23503";

/**
 * Gives the person the gear a paid one-time Checkout session bought. Safe to run more than once
 * (webhook retries plus the success page): rows already there are skipped. Returns rows added.
 * Throws on a database error so the webhook answers 500 and Stripe retries, except a deleted
 * account (FK violation), which is logged and treated as handled so Stripe stops retrying.
 * `from: "webhook"` warns when fewer rows are added than bought; the success page legitimately
 * adds 0 after the webhook already ran, so it doesn't warn.
 */
export async function recordGearPurchase(
  session: Stripe.Checkout.Session,
  from: "webhook" | "success" = "success",
): Promise<number> {
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
  if (error) {
    if (error.code === FK_VIOLATION) {
      console.error("gear purchase for a deleted account, not delivered", session.id, userId);
      return 0;
    }
    throw error;
  }
  const added = data?.length ?? 0;
  if (from === "webhook" && added < items.length) {
    console.warn("gear purchase added fewer items than bought", session.id, { bought: items.length, added });
  }
  return added;
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
    return await recordGearPurchase(session, "success");
  } catch (e) {
    console.error("refresh gear purchase failed", sessionId, e);
    return 0;
  }
}
