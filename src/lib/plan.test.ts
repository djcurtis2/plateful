import { test } from "node:test";
import assert from "node:assert/strict";
import { hasPlus } from "./plan.ts";

const base = { plan: "free" as const, subscription_status: null, bonus_until: null, apple_until: null };
const now = new Date("2026-12-01T00:00:00Z");

test("apple plus counts while apple_until is ahead", () => {
  assert.equal(hasPlus({ ...base, apple_until: "2026-12-05T00:00:00Z" }, now), true);
  assert.equal(hasPlus({ ...base, apple_until: "2026-11-30T00:00:00Z" }, now), false);
});

test("stripe and apple are independent", () => {
  assert.equal(hasPlus({ ...base, plan: "plus", subscription_status: "active", apple_until: "2026-11-01T00:00:00Z" }, now), true);
  assert.equal(hasPlus({ ...base, plan: "free", subscription_status: "canceled", apple_until: "2027-01-01T00:00:00Z" }, now), true);
});

test("no source means free", () => assert.equal(hasPlus(base, now), false));
