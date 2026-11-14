// Rules for Apple in-app purchases (through RevenueCat). Pure functions, no I/O.
// Events come from RevenueCat's webhook; subscriber snapshots from its REST API (the fallback refresh).
import { BUNDLES, GEAR_BY_ID } from "./avatar.ts";
import { gearForAppleProduct } from "./app-shell.ts";

export const PLUS_PRODUCTS = ["yumjack_plus_monthly", "yumjack_plus_yearly"] as const;
/** The RevenueCat entitlement both Plus products unlock. */
export const PLUS_ENTITLEMENT = "plus";
/** RevenueCat's cancel_reason for a refund (Apple support or a refund request). */
const REFUND = "CUSTOMER_SUPPORT";

export type RevenueCatEvent = {
  id: string;
  type: string;
  app_user_id: string;
  product_id: string;
  expiration_at_ms: number | null;
  event_timestamp_ms: number;
  transaction_id: string | null;
  store: string;
  cancel_reason?: string | null;
  grace_period_expiration_at_ms?: number | null;
  original_app_user_id?: string | null;
  aliases?: string[];
  transferred_from?: string[];
  transferred_to?: string[];
};

type GearTarget = { item: string } | { bundle: string };

export type AppleChange =
  | { kind: "plus"; apple_until: string | null; apple_status: string; apple_product: string }
  | { kind: "gear_grant"; target: GearTarget; transactionId: string }
  | { kind: "gear_revoke"; transactionId: string }
  | { kind: "ignore" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUserId = (s: unknown): s is string => typeof s === "string" && UUID.test(s);

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

/** Reads the `event` object of a RevenueCat webhook body. Null when it isn't one. */
export function parseRevenueCatEvent(raw: unknown): RevenueCatEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, unknown>;
  const id = str(e.id);
  const type = str(e.type);
  const at = num(e.event_timestamp_ms);
  if (!id || !type || at === null) return null;
  const tx = e.transaction_id;
  return {
    id,
    type,
    app_user_id: str(e.app_user_id),
    product_id: str(e.product_id),
    expiration_at_ms: num(e.expiration_at_ms),
    event_timestamp_ms: at,
    transaction_id: typeof tx === "string" && tx ? tx : typeof tx === "number" ? String(tx) : null,
    store: str(e.store),
    cancel_reason: str(e.cancel_reason) || null,
    grace_period_expiration_at_ms: num(e.grace_period_expiration_at_ms),
    original_app_user_id: str(e.original_app_user_id) || null,
    aliases: strs(e.aliases),
    transferred_from: strs(e.transferred_from),
    transferred_to: strs(e.transferred_to),
  };
}

/** The Yumjack user an event belongs to. Anonymous RevenueCat ids ($RCAnonymousID:…) are skipped. */
export function eventUserId(e: RevenueCatEvent): string | null {
  return [e.app_user_id, e.original_app_user_id, ...(e.aliases ?? [])].find(isUserId) ?? null;
}

const iso = (ms: number) => new Date(ms).toISOString();
const ms = (s: string | null) => (s ? new Date(s).getTime() : null);
/** The later of two dates, so a replayed old event never cuts Plus short. */
function later(current: string | null, next: number): string {
  const c = ms(current);
  return c !== null && c > next ? current! : iso(next);
}

/**
 * What one RevenueCat event changes. Plus only ever moves forward, except an EXPIRATION that matches what we
 * have, or a refund (which ends it at the refund time). Gear is granted on purchase and taken back on refund.
 */
export function applyAppleEvent(event: RevenueCatEvent, current: { apple_until: string | null }): AppleChange {
  const ignore: AppleChange = { kind: "ignore" };
  if (event.store !== "APP_STORE" || event.type === "TRANSFER") return ignore;
  const refund = event.type === "CANCELLATION" && event.cancel_reason === REFUND;
  const exp = event.expiration_at_ms;

  if ((PLUS_PRODUCTS as readonly string[]).includes(event.product_id)) {
    const plus = (apple_until: string | null, apple_status: string): AppleChange => ({
      kind: "plus", apple_until, apple_status, apple_product: event.product_id,
    });
    const now = ms(current.apple_until);
    // An event about a period older than the one we know: a newer renewal already happened.
    const stale = exp !== null && now !== null && exp < now;
    switch (event.type) {
      case "INITIAL_PURCHASE":
      case "RENEWAL":
      case "UNCANCELLATION":
      case "PRODUCT_CHANGE":
      case "SUBSCRIPTION_EXTENDED":
      case "REFUND_REVERSED":
      case "TEMPORARY_ENTITLEMENT_GRANT":
        return exp === null ? ignore : plus(later(current.apple_until, exp), "active");
      case "CANCELLATION":
        // RevenueCat sends a refund CANCELLATION only for the latest period, and its expiration is often the
        // refund time itself (earlier than what we have), so a refund is never "stale".
        if (refund) return plus(iso(event.event_timestamp_ms), "refunded");
        if (stale) return ignore;
        // Turned off auto-renew: they paid through the period, so it stays.
        return plus(current.apple_until ?? (exp === null ? null : iso(exp)), "canceled");
      case "BILLING_ISSUE": {
        // Apple keeps trying during its grace period; access stays until it ends.
        const until = event.grace_period_expiration_at_ms ?? exp;
        if (stale || until === null) return ignore;
        return plus(later(current.apple_until, until), "billing_issue");
      }
      case "EXPIRATION":
        return exp === null || stale ? ignore : plus(iso(exp), "expired");
      default:
        return ignore;
    }
  }

  const gear = gearForAppleProduct(event.product_id);
  if (!gear || !event.transaction_id) return ignore;
  if (event.type === "NON_RENEWING_PURCHASE" || event.type === "REFUND_REVERSED") {
    return { kind: "gear_grant", target: gear, transactionId: event.transaction_id };
  }
  if (refund) return { kind: "gear_revoke", transactionId: event.transaction_id };
  return ignore;
}

/**
 * The user_gear rows an Apple purchase adds: a bundle becomes its items, items already owned are skipped,
 * and only shop gear can ever come this way. Bundle rows get "<transaction>:<item>" so the unique index holds.
 */
export function appleGearRows(target: GearTarget, transactionId: string, owned: string[]): { item_id: string; apple_transaction_id: string }[] {
  const bundle = "bundle" in target ? BUNDLES.find((b) => b.id === target.bundle) : null;
  const items = "item" in target ? [target.item] : (bundle?.items ?? []);
  return items
    .filter((id) => GEAR_BY_ID[id]?.source.kind === "shop" && !owned.includes(id))
    .map((item_id) => ({ item_id, apple_transaction_id: bundle ? `${transactionId}:${item_id}` : transactionId }));
}

/** The purchase a stored apple_transaction_id came from ("88:cat-ears" → "88"). */
export const appleTransactionOf = (stored: string) => stored.split(":")[0];

/** Items to take back: Apple gear whose purchase RevenueCat no longer lists (refunded or moved to another account). */
export function appleGearToRevoke(rows: { item_id: string; apple_transaction_id: string | null }[], present: Set<string>): string[] {
  return rows.filter((r) => r.apple_transaction_id && !present.has(appleTransactionOf(r.apple_transaction_id))).map((r) => r.item_id);
}

// The parts of RevenueCat's GET /v1/subscribers/{id} response we read.
type RcSubscription = {
  expires_date?: string | null;
  unsubscribe_detected_at?: string | null;
  billing_issues_detected_at?: string | null;
  refunded_at?: string | null;
};
export type RcSubscriber = {
  entitlements?: Record<string, { expires_date?: string | null; product_identifier?: string } | undefined>;
  subscriptions?: Record<string, RcSubscription | undefined>;
  non_subscriptions?: Record<string, { id?: string; store_transaction_id?: string | number | null }[] | undefined>;
};

/**
 * Plus as RevenueCat sees it now. null: no Apple Plus at all (never bought, or moved to another account);
 * undefined: an entitlement without an end date (not something we sell), so leave the profile alone.
 */
export function applePlusFromSubscriber(
  s: RcSubscriber,
  now = new Date(),
): { apple_until: string; apple_status: string; apple_product: string } | null | undefined {
  const fromEntitlement = plusFromEntitlement(s, now);
  if (fromEntitlement === undefined || (fromEntitlement && fromEntitlement.apple_status !== "expired")) return fromEntitlement;
  // Backup: a live Plus subscription counts even if the "plus" entitlement is missing or misnamed in RevenueCat,
  // so a setup slip never switches off Plus for someone still paying.
  return livePlusSubscription(s, now) ?? fromEntitlement;
}

/** The latest Plus subscription that hasn't ended and wasn't refunded, or null. */
function livePlusSubscription(s: RcSubscriber, now: Date): { apple_until: string; apple_status: string; apple_product: string } | null {
  let best: { apple_until: string; apple_status: string; apple_product: string } | null = null;
  for (const product of PLUS_PRODUCTS) {
    const sub = s.subscriptions?.[product];
    if (!sub?.expires_date || sub.refunded_at) continue;
    const end = new Date(sub.expires_date);
    if (!(end > now) || (best && end <= new Date(best.apple_until))) continue;
    const apple_status = sub.billing_issues_detected_at ? "billing_issue" : sub.unsubscribe_detected_at ? "canceled" : "active";
    best = { apple_until: end.toISOString(), apple_status, apple_product: product };
  }
  return best;
}

function plusFromEntitlement(s: RcSubscriber, now: Date): { apple_until: string; apple_status: string; apple_product: string } | null | undefined {
  const ent = s.entitlements?.[PLUS_ENTITLEMENT];
  if (!ent) return null;
  if (!ent.expires_date || !ent.product_identifier) return undefined;
  const sub = s.subscriptions?.[ent.product_identifier] ?? {};
  const apple_status = sub.refunded_at
    ? "refunded"
    : new Date(ent.expires_date) <= now
      ? "expired"
      : sub.billing_issues_detected_at
        ? "billing_issue"
        : sub.unsubscribe_detected_at
          ? "canceled"
          : "active";
  // A refund ends Plus at the refund, even if the entitlement still shows the old end date.
  const end = Math.min(new Date(ent.expires_date).getTime(), sub.refunded_at ? new Date(sub.refunded_at).getTime() : Infinity);
  return { apple_until: new Date(end).toISOString(), apple_status, apple_product: ent.product_identifier };
}

export type AppleGearPurchase = { target: GearTarget; transactionId: string; ids: string[]; hasStoreId: boolean };

/**
 * Gear purchases RevenueCat lists, with every id each one may be stored under (store transaction id, RevenueCat id).
 * `hasStoreId` is false when RevenueCat left out the store transaction id that webhooks use; then the refresh must not
 * take gear back, because webhook-recorded rows would look missing.
 */
export function appleGearFromSubscriber(s: RcSubscriber): AppleGearPurchase[] {
  const out: AppleGearPurchase[] = [];
  const present = (x: unknown) => x !== null && x !== undefined && x !== "";
  for (const [product, purchases] of Object.entries(s.non_subscriptions ?? {})) {
    const target = gearForAppleProduct(product);
    if (!target || !Array.isArray(purchases)) continue;
    for (const p of purchases) {
      const ids = [p.store_transaction_id, p.id].filter(present).map(String);
      if (ids.length) out.push({ target, transactionId: ids[0], ids, hasStoreId: present(p.store_transaction_id) });
    }
  }
  return out;
}
