import { test } from "node:test";
import assert from "node:assert/strict";
import {
  appleGearFromSubscriber, appleGearRows, applePlusFromSubscriber, applyAppleEvent, appleGearToRevoke, eventUserId, parseRevenueCatEvent,
  type RevenueCatEvent,
} from "./apple-billing.ts";

const DEC1 = Date.UTC(2026, 11, 1);
const JAN1 = Date.UTC(2027, 0, 1);
const iso = (ms: number) => new Date(ms).toISOString();
const UID = "0b8f3c1e-2a4d-4c6b-9e7f-1a2b3c4d5e6f";

function ev(over: Partial<RevenueCatEvent>): RevenueCatEvent {
  return {
    id: "evt-1",
    type: "RENEWAL",
    app_user_id: UID,
    product_id: "yumjack_plus_monthly",
    expiration_at_ms: JAN1,
    event_timestamp_ms: Date.UTC(2026, 11, 15),
    transaction_id: "2000000111",
    store: "APP_STORE",
    ...over,
  };
}

test("RENEWAL moves apple_until forward", () => {
  assert.deepEqual(applyAppleEvent(ev({ expiration_at_ms: JAN1 }), { apple_until: iso(DEC1) }), {
    kind: "plus", apple_until: iso(JAN1), apple_status: "active", apple_product: "yumjack_plus_monthly",
  });
});

test("an older RENEWAL replayed never moves apple_until back", () => {
  const c = applyAppleEvent(ev({ expiration_at_ms: DEC1 }), { apple_until: iso(JAN1) });
  assert.equal(c.kind, "plus");
  assert.equal(c.kind === "plus" && c.apple_until, iso(JAN1));
});

test("EXPIRATION older than apple_until is ignored; matching one ends Plus", () => {
  assert.deepEqual(applyAppleEvent(ev({ type: "EXPIRATION", expiration_at_ms: DEC1 }), { apple_until: iso(JAN1) }), { kind: "ignore" });
  assert.deepEqual(applyAppleEvent(ev({ type: "EXPIRATION", expiration_at_ms: JAN1 }), { apple_until: iso(JAN1) }), {
    kind: "plus", apple_until: iso(JAN1), apple_status: "expired", apple_product: "yumjack_plus_monthly",
  });
});

test("CANCELLATION (not a refund) keeps the paid period", () => {
  for (const cancel_reason of ["UNSUBSCRIBE", "BILLING_ERROR", "UNKNOWN", undefined]) {
    assert.deepEqual(applyAppleEvent(ev({ type: "CANCELLATION", cancel_reason }), { apple_until: iso(JAN1) }), {
      kind: "plus", apple_until: iso(JAN1), apple_status: "canceled", apple_product: "yumjack_plus_monthly",
    });
  }
});

test("refund CANCELLATION on Plus ends it at the event time", () => {
  const at = Date.UTC(2026, 11, 20);
  assert.deepEqual(applyAppleEvent(ev({ type: "CANCELLATION", cancel_reason: "CUSTOMER_SUPPORT", event_timestamp_ms: at }), { apple_until: iso(JAN1) }), {
    kind: "plus", apple_until: iso(at), apple_status: "refunded", apple_product: "yumjack_plus_monthly",
  });
});

test("refund CANCELLATION whose expiration is the refund time (earlier than apple_until) still ends Plus", () => {
  const at = Date.UTC(2026, 11, 20);
  assert.deepEqual(
    applyAppleEvent(ev({ type: "CANCELLATION", cancel_reason: "CUSTOMER_SUPPORT", event_timestamp_ms: at, expiration_at_ms: at }), { apple_until: iso(JAN1) }),
    { kind: "plus", apple_until: iso(at), apple_status: "refunded", apple_product: "yumjack_plus_monthly" },
  );
});

test("BILLING_ISSUE keeps access through the grace period", () => {
  const grace = Date.UTC(2027, 0, 17);
  const c = applyAppleEvent(ev({ type: "BILLING_ISSUE", expiration_at_ms: JAN1, grace_period_expiration_at_ms: grace }), { apple_until: iso(JAN1) });
  assert.deepEqual(c, { kind: "plus", apple_until: iso(grace), apple_status: "billing_issue", apple_product: "yumjack_plus_monthly" });
});

test("gear: bundle purchase grants, refund revokes by transaction id", () => {
  const buy = ev({ type: "NON_RENEWING_PURCHASE", product_id: "bundle_party_night", expiration_at_ms: null, transaction_id: "2000000999" });
  assert.deepEqual(applyAppleEvent(buy, { apple_until: null }), { kind: "gear_grant", target: { bundle: "party-night" }, transactionId: "2000000999" });
  const refund = { ...buy, type: "CANCELLATION", cancel_reason: "CUSTOMER_SUPPORT" };
  assert.deepEqual(applyAppleEvent(refund, { apple_until: null }), { kind: "gear_revoke", transactionId: "2000000999" });
});

test("other stores, unknown products, TRANSFER and TEST are ignored", () => {
  assert.deepEqual(applyAppleEvent(ev({ store: "PLAY_STORE" }), { apple_until: null }), { kind: "ignore" });
  assert.deepEqual(applyAppleEvent(ev({ product_id: "foo" }), { apple_until: null }), { kind: "ignore" });
  assert.deepEqual(applyAppleEvent(ev({ type: "TRANSFER" }), { apple_until: null }), { kind: "ignore" });
  assert.deepEqual(applyAppleEvent(ev({ type: "TEST" }), { apple_until: null }), { kind: "ignore" });
});

test("only Supabase user ids are used (anonymous ids fall back to aliases)", () => {
  assert.equal(eventUserId(ev({})), UID);
  assert.equal(eventUserId(ev({ app_user_id: "$RCAnonymousID:abc" })), null);
  assert.equal(eventUserId(ev({ app_user_id: "$RCAnonymousID:abc", aliases: ["$RCAnonymousID:abc", UID] })), UID);
});

test("parseRevenueCatEvent keeps the fields we use and rejects junk", () => {
  assert.equal(parseRevenueCatEvent(null), null);
  assert.equal(parseRevenueCatEvent({ type: "RENEWAL" }), null);
  const e = parseRevenueCatEvent({
    id: "x", type: "TRANSFER", event_timestamp_ms: 5, transferred_from: [UID, 3], transferred_to: ["$RCAnonymousID:a"],
  });
  assert.deepEqual(e?.transferred_from, [UID]);
  assert.equal(e?.app_user_id, "");
  assert.equal(e?.expiration_at_ms, null);
});

test("gear rows: bundles expand, owned items skipped, one row per item", () => {
  assert.deepEqual(appleGearRows({ item: "tuxedo" }, "77", []), [{ item_id: "tuxedo", apple_transaction_id: "77" }]);
  assert.deepEqual(appleGearRows({ item: "tuxedo" }, "77", ["tuxedo"]), []);
  assert.deepEqual(appleGearRows({ bundle: "party-night" }, "88", ["tuxedo"]), [
    { item_id: "disco-floor", apple_transaction_id: "88:disco-floor" },
    { item_id: "cat-ears", apple_transaction_id: "88:cat-ears" },
  ]);
  assert.deepEqual(appleGearRows({ item: "velvet-toque" }, "99", []), []); // Plus gear is never sold
});

test("refresh: Plus from the plus entitlement and its subscription", () => {
  const now = new Date(Date.UTC(2026, 11, 10));
  const sub = (s: object) => ({
    entitlements: { plus: { expires_date: iso(JAN1), product_identifier: "yumjack_plus_yearly" } },
    subscriptions: { yumjack_plus_yearly: { expires_date: iso(JAN1), unsubscribe_detected_at: null, billing_issues_detected_at: null, ...s } },
  });
  assert.deepEqual(applePlusFromSubscriber(sub({}), now), { apple_until: iso(JAN1), apple_status: "active", apple_product: "yumjack_plus_yearly" });
  assert.equal(applePlusFromSubscriber(sub({ unsubscribe_detected_at: iso(DEC1) }), now)?.apple_status, "canceled");
  assert.equal(applePlusFromSubscriber(sub({ billing_issues_detected_at: iso(DEC1) }), now)?.apple_status, "billing_issue");
  assert.equal(applePlusFromSubscriber(sub({ refunded_at: iso(DEC1) }), now)?.apple_status, "refunded");
  assert.equal(applePlusFromSubscriber(sub({ refunded_at: iso(DEC1) }), now)?.apple_until, iso(DEC1)); // ends at the refund
  assert.equal(applePlusFromSubscriber(sub({}), new Date(JAN1 + 1))?.apple_status, "expired");
  assert.equal(applePlusFromSubscriber({ entitlements: {} }, now), null);
  assert.equal(applePlusFromSubscriber({ entitlements: { plus: { expires_date: null, product_identifier: "x" } } }, now), undefined);
});

test("refresh: gear purchases carry both ids and say whether the store id is there", () => {
  assert.deepEqual(
    appleGearFromSubscriber({ non_subscriptions: { gear_tuxedo: [{ id: "rc1", store_transaction_id: "2000000777" }], foo: [{ id: "x" }] } }),
    [{ target: { item: "tuxedo" }, transactionId: "2000000777", ids: ["2000000777", "rc1"], hasStoreId: true }],
  );
  assert.deepEqual(appleGearFromSubscriber({ non_subscriptions: { bundle_party_night: [{ id: "rc2" }] } }), [
    { target: { bundle: "party-night" }, transactionId: "rc2", ids: ["rc2"], hasStoreId: false },
  ]);
});

test("refresh: Apple gear whose purchase is gone is revoked", () => {
  const rows = [
    { item_id: "tuxedo", apple_transaction_id: "77" },
    { item_id: "disco-floor", apple_transaction_id: "88:disco-floor" },
    { item_id: "cat-ears", apple_transaction_id: "88:cat-ears" },
  ];
  assert.deepEqual(appleGearToRevoke(rows, new Set(["77", "88"])), []);
  assert.deepEqual(appleGearToRevoke(rows, new Set(["77"])), ["disco-floor", "cat-ears"]);
});
