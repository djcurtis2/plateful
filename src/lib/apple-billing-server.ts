import "server-only";
import { admin } from "@/lib/supabase/admin";
import {
  appleGearFromSubscriber, appleGearRows, appleGearToRevoke, applePlusFromSubscriber, applyAppleEvent, eventUserId, isUserId,
  type RcSubscriber, type RevenueCatEvent,
} from "@/lib/apple-billing";

type GearTarget = { item: string } | { bundle: string };

/** Postgres unique violation: this Apple transaction is already recorded (a replay, or a race with the refresh). */
const UNIQUE_VIOLATION = "23505";

/** Escapes LIKE wildcards so a transaction id is matched literally. */
const likeLiteral = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
const ms = (s: string | null) => (s ? new Date(s).getTime() : null);

/** Adds the gear one Apple purchase bought. Safe to repeat: owned items and recorded transactions are skipped. Throws on a database error. */
async function grantAppleGear(userId: string, target: GearTarget, transactionId: string): Promise<boolean> {
  const db = admin();
  const { data: gear, error } = await db.from("user_gear").select("item_id").eq("user_id", userId);
  if (error) throw error;
  const rows = appleGearRows(target, transactionId, (gear ?? []).map((g) => g.item_id));
  if (!rows.length) return false;
  // Rows for this purchase already on someone (a transfer not yet cleaned up): leave those alone.
  const { data: taken, error: takenError } = await db
    .from("user_gear")
    .select("apple_transaction_id")
    .in("apple_transaction_id", rows.map((r) => r.apple_transaction_id));
  if (takenError) throw takenError;
  const skip = new Set((taken ?? []).map((t) => t.apple_transaction_id));
  const fresh = rows.filter((r) => !skip.has(r.apple_transaction_id));
  if (!fresh.length) return false;
  const { data, error: insertError } = await db
    .from("user_gear")
    .upsert(
      fresh.map((r) => ({ user_id: userId, item_id: r.item_id, source: "apple" as const, apple_transaction_id: r.apple_transaction_id })),
      { onConflict: "user_id,item_id", ignoreDuplicates: true },
    )
    .select("item_id");
  if (insertError) {
    if (insertError.code === UNIQUE_VIOLATION) return false;
    throw insertError;
  }
  return (data?.length ?? 0) > 0;
}

/** Takes back the gear from one refunded Apple purchase (single item, or every row of a bundle). Throws on a database error. */
async function revokeAppleGear(transactionId: string): Promise<void> {
  const db = admin();
  const one = await db.from("user_gear").delete().eq("source", "apple").eq("apple_transaction_id", transactionId);
  if (one.error) throw one.error;
  const bundle = await db.from("user_gear").delete().eq("source", "apple").like("apple_transaction_id", `${likeLiteral(transactionId)}:%`);
  if (bundle.error) throw bundle.error;
}

/**
 * Records one RevenueCat webhook event. Events for anonymous ids, other stores or unknown products do nothing.
 * Throws only on a database error (the webhook then answers 500 and RevenueCat retries).
 */
export async function recordAppleEvent(event: RevenueCatEvent): Promise<void> {
  if (event.type === "TRANSFER") {
    // A purchase moved between accounts (Restore purchases on another sign-in). Ask RevenueCat about both sides,
    // the old owner first so its rows are gone before the new owner's are added.
    const from = (event.transferred_from ?? []).filter(isUserId);
    const to = (event.transferred_to ?? []).filter(isUserId);
    for (const id of [...new Set([...from, ...to])]) await syncFromRevenueCat(id);
    return;
  }
  const userId = eventUserId(event);
  if (!userId) return;
  const db = admin();
  const { data: profile, error } = await db.from("profiles").select("apple_until").eq("id", userId).maybeSingle();
  if (error) throw error;
  if (!profile) return; // deleted account
  const change = applyAppleEvent(event, { apple_until: profile.apple_until });
  switch (change.kind) {
    case "plus": {
      const { kind: _, ...update } = change;
      let q = db.from("profiles").update(update).eq("id", userId);
      // Only a refund or an expiration may pull apple_until back. Anything else writes only if no newer end date
      // landed since we read the profile (two events at once), so the later date always wins.
      const pullsBack = update.apple_status === "refunded" || update.apple_status === "expired";
      if (!pullsBack && update.apple_until) q = q.or(`apple_until.is.null,apple_until.lte."${update.apple_until}"`);
      const { error: e } = await q;
      if (e) throw e;
      return;
    }
    case "gear_grant":
      await grantAppleGear(userId, change.target, change.transactionId);
      return;
    case "gear_revoke":
      await revokeAppleGear(change.transactionId);
      return;
    case "ignore":
      return;
  }
}

/** Asks RevenueCat for this user's purchases and copies them onto the profile and gear. Throws on errors. */
async function syncFromRevenueCat(userId: string): Promise<boolean> {
  const key = process.env.REVENUECAT_SECRET_KEY;
  if (!key || !isUserId(userId)) return false;
  const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`RevenueCat subscriber lookup failed: ${res.status}`);
  const body = (await res.json()) as { subscriber?: RcSubscriber };
  const subscriber = body.subscriber;
  if (!subscriber || typeof subscriber !== "object") throw new Error("RevenueCat subscriber lookup: no subscriber");

  const db = admin();
  const { data: profile, error } = await db.from("profiles").select("apple_until, apple_status, apple_product").eq("id", userId).maybeSingle();
  if (error) throw error;
  if (!profile) return false;
  let changed = false;

  const plus = applePlusFromSubscriber(subscriber);
  // null: no Apple Plus here any more; clear only what Apple set (Stripe and bonus time are separate columns).
  const next = plus === null ? { apple_until: null, apple_status: null, apple_product: null } : plus;
  const same =
    !!next &&
    ms(next.apple_until) === ms(profile.apple_until) &&
    next.apple_status === profile.apple_status &&
    next.apple_product === profile.apple_product;
  if (next && !same) {
    const { error: e } = await db.from("profiles").update(next).eq("id", userId);
    if (e) throw e;
    changed = true;
  }

  if (subscriber.non_subscriptions && typeof subscriber.non_subscriptions === "object") {
    const purchases = appleGearFromSubscriber(subscriber);
    for (const p of purchases) {
      if (await grantAppleGear(userId, p.target, p.transactionId)) changed = true;
    }
    if (purchases.some((p) => !p.hasStoreId)) {
      // Webhook rows are keyed by the store transaction id; without it we can't tell refunded gear from kept gear.
      console.warn("RevenueCat listed gear without store_transaction_id; skipping gear revoke", userId);
      return changed;
    }
    const present = new Set(purchases.flatMap((p) => p.ids));
    const { data: rows, error: rowsError } = await db.from("user_gear").select("item_id, apple_transaction_id").eq("user_id", userId).eq("source", "apple");
    if (rowsError) throw rowsError;
    const gone = appleGearToRevoke(rows ?? [], present);
    if (gone.length) {
      const { error: e } = await db.from("user_gear").delete().eq("user_id", userId).eq("source", "apple").in("item_id", gone);
      if (e) throw e;
      changed = true;
    }
  }
  return changed;
}

/**
 * Account deletion: removes this cook's RevenueCat customer record (purchase history, app user id).
 * Best effort: logged on failure, never throws, gives up after 5 seconds. Apple subscriptions themselves can't be cancelled here.
 */
export async function deleteRevenueCatSubscriber(userId: string): Promise<void> {
  const key = process.env.REVENUECAT_SECRET_KEY;
  if (!key || !isUserId(userId)) return;
  try {
    const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok && res.status !== 404) console.error("delete account: RevenueCat delete failed", res.status);
  } catch (e) {
    console.error("delete account: RevenueCat delete failed", e);
  }
}

/**
 * Backup for the webhook, like refreshFromStripe: run after a purchase or restore and when the app opens.
 * Returns true if anything changed. Never throws; false when RevenueCat isn't set up.
 */
export async function refreshFromRevenueCat(userId: string): Promise<boolean> {
  try {
    return await syncFromRevenueCat(userId);
  } catch (e) {
    console.error("refresh from RevenueCat failed", e);
    return false;
  }
}
