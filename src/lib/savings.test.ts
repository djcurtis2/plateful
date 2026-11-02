import { test } from "node:test";
import assert from "node:assert/strict";
import { dollars, nextMilestone, outPrice, savingsFor } from "./savings.ts";

test("copycats use the menu price; others a similar dish, then a meal average", () => {
  assert.deepEqual(outPrice({ menu_price: 11.25, plate_cost: 3.4, meals: ["lunch"] }), { price: 11.25, compare: "menu" });
  assert.deepEqual(outPrice({ menu_price: null, out_price: 14, plate_cost: 3, meals: ["dinner"] }), { price: 14, compare: "similar" });
  assert.deepEqual(outPrice({ menu_price: null, plate_cost: 3, meals: ["lunch", "dinner"] }), { price: 15, compare: "average" });
  assert.equal(outPrice({ menu_price: null, plate_cost: 3, meals: [] }), null);
});

test("savings per cook: capped servings, never negative", () => {
  assert.deepEqual(savingsFor({ menu_price: 11.25, plate_cost: 3.4, meals: [] }, 2), { servings: 2, home: 6.8, out: 22.5, saved: 15.7, compare: "menu" });
  assert.equal(savingsFor({ menu_price: 11.25, plate_cost: 3.4, meals: [] }, 50)?.servings, 8);
  assert.equal(savingsFor({ menu_price: 4, plate_cost: 6, meals: [] }, 2)?.saved, 0);
  assert.equal(savingsFor({ menu_price: 10, plate_cost: null, meals: [] }, 2), null);
});

test("milestones and money formatting", () => {
  assert.deepEqual(nextMilestone(40), { amount: 100, toGo: 60, progress: 0.4 });
  assert.equal(nextMilestone(750)?.amount, 1000);
  assert.equal(nextMilestone(12000), null);
  assert.equal(dollars(1240.5), "$1,241");
  assert.equal(dollars(12345, true), "$12.3k");
});

test("shareable orders are split per plate", () => {
  // $12.49 nachos platter that feeds 3, made at home for $2.50 a plate, for 4 people.
  assert.deepEqual(savingsFor({ menu_price: 12.49, menu_serves: 3, plate_cost: 2.5, meals: ["snack"] }, 4), {
    servings: 4,
    home: 10,
    out: 16.64,
    saved: 6.64,
    compare: "menu",
  });
});
