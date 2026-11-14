import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aasa, appleBundleAllowed, appleProductForGear, gearForAppleProduct, groceryStoresShown,
  isAppUserAgent, plusOffers, plusSource, stripeLinkAllowed,
} from "./app-shell.ts";

test("user agent marker", () => {
  assert.equal(isAppUserAgent("Mozilla/5.0 ... YumjackApp/1"), true);
  assert.equal(isAppUserAgent("Mozilla/5.0 Safari"), false);
  assert.equal(isAppUserAgent(null), false);
});

test("plus source order: stripe, apple, bonus", () => {
  const now = new Date("2026-11-14T00:00:00Z");
  const future = "2026-12-01T00:00:00Z";
  const past = "2026-10-01T00:00:00Z";
  const base = { plan: "free" as const, subscription_status: null, bonus_until: null, apple_until: null };
  assert.equal(plusSource(base, now), null);
  assert.equal(plusSource({ ...base, bonus_until: future }, now), "bonus");
  assert.equal(plusSource({ ...base, bonus_until: future, apple_until: future }, now), "apple");
  assert.equal(plusSource({ ...base, apple_until: past }, now), null);
  assert.equal(plusSource({ ...base, plan: "plus", subscription_status: "active", apple_until: future, bonus_until: future }, now), "stripe");
  assert.equal(plusSource({ ...base, plan: "plus", subscription_status: "canceled", apple_until: future }, now), "apple");
});

test("offers: nothing to buy when already Plus", () => {
  assert.deepEqual(plusOffers("stripe", "USA"), { apple: false, stripe: false, note: "You have Plus (via yumjack.app)" });
  assert.deepEqual(plusOffers("apple", "USA"), { apple: false, stripe: false, note: "You have Plus (via Apple)" });
});

test("offers: both in the US, Apple only elsewhere", () => {
  assert.deepEqual(plusOffers(null, "USA"), { apple: true, stripe: true, note: null });
  assert.deepEqual(plusOffers(null, "GBR"), { apple: true, stripe: false, note: null });
  assert.deepEqual(plusOffers("bonus", "USA"), { apple: true, stripe: true, note: null });
});

test("gear product ids round-trip and reject unknowns", () => {
  assert.equal(appleProductForGear({ bundle: "party-night" }), "bundle_party_night");
  assert.deepEqual(gearForAppleProduct("bundle_party_night"), { bundle: "party-night" });
  assert.equal(appleProductForGear({ item: "pizza-slice" }), "gear_pizza_slice");
  assert.deepEqual(gearForAppleProduct("gear_pizza_slice"), { item: "pizza-slice" });
  assert.equal(gearForAppleProduct("gear_not_a_thing"), null);
  assert.equal(gearForAppleProduct("yumjack_plus_monthly"), null);
  assert.equal(gearForAppleProduct("gear___proto__"), null);
});

test("bundle on Apple only when owning none of it", () => {
  assert.equal(appleBundleAllowed("party-night", []), true);
  assert.equal(appleBundleAllowed("party-night", ["tuxedo"]), false);
  assert.equal(appleBundleAllowed("nope", []), false);
});

test("grocery stores and stripe link by storefront", () => {
  assert.equal(stripeLinkAllowed("USA"), true);
  assert.equal(stripeLinkAllowed("CAN"), false);
  assert.equal(stripeLinkAllowed(null), false);
  assert.equal(groceryStoresShown("CAN"), true);
  assert.equal(groceryStoresShown("FRA"), false);
  assert.equal(groceryStoresShown(null), true);
});

test("aasa lists the app and the callback", () => {
  const j = aasa("TEAM123", "app.yumjack.ios") as any;
  assert.equal(j.applinks.details[0].appIDs[0], "TEAM123.app.yumjack.ios");
  assert.ok(JSON.stringify(j).includes("/auth/callback"));
});
