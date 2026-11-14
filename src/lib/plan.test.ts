import { test } from "node:test";
import assert from "node:assert/strict";
import { hasPlus, selectWithApple } from "./plan.ts";

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

test("selectWithApple uses the apple columns when the database has them", async () => {
  const asked: string[] = [];
  const data = await selectWithApple(async (cols) => {
    asked.push(cols);
    return { data: { id: "a", apple_until: "2027-01-01T00:00:00Z", apple_status: "active" }, error: null };
  });
  assert.deepEqual(asked, [", apple_until, apple_status"]);
  assert.deepEqual(data, { id: "a", apple_until: "2027-01-01T00:00:00Z", apple_status: "active" });
});

test("selectWithApple retries once without the apple columns and fills them with null (0018 not run yet)", async () => {
  const asked: string[] = [];
  const one = await selectWithApple(async (cols) => {
    asked.push(cols);
    return cols ? { data: null, error: { message: "column profiles.apple_until does not exist" } } : { data: { id: "a" }, error: null };
  });
  assert.deepEqual(asked, [", apple_until, apple_status", ""]);
  assert.deepEqual(one, { id: "a", apple_until: null, apple_status: null });
  const many = await selectWithApple(async (cols) => (cols ? { data: null, error: { message: "x" } } : { data: [{ id: "a" }, { id: "b" }], error: null }));
  assert.deepEqual(many, [{ id: "a", apple_until: null, apple_status: null }, { id: "b", apple_until: null, apple_status: null }]);
  const none = await selectWithApple(async () => ({ data: null, error: { message: "x" } }));
  assert.equal(none, null);
});
