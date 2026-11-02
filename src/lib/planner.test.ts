import { test } from "node:test";
import assert from "node:assert/strict";
import { planWeek, summarize, swapMeal, type PlanRecipe } from "./planner.ts";
import { SAMPLES } from "./samples.ts";

const pool: PlanRecipe[] = SAMPLES.map((s, i) => ({ ...s, id: `id${i}`, source: "snap", image_url: null }));
const settings = { dinners: 5, servings: 2, maxMinutes: null, cuisines: [] as string[] };

test("plans the right number of distinct dinners", () => {
  const week = planWeek(pool, settings, []);
  assert.equal(week.length, 5);
  assert.equal(new Set(week.map((r) => r.id)).size, 5);
  for (const r of week) assert.ok(!r.meals.length || r.meals.includes("dinner"), r.dish);
});

test("respects time and cuisine limits, and includes what you asked for", () => {
  const tacos = pool.find((r) => r.slug.startsWith("weeknight-chipotle"))!;
  const week = planWeek(pool, { ...settings, dinners: 3, maxMinutes: 30, cuisines: ["Mexican", "American"] }, [], { include: [tacos] });
  assert.equal(week[0].id, tacos.id);
  for (const r of week) {
    assert.ok((r.minutes ?? 0) <= 30 || r.id === tacos.id, r.dish);
    assert.ok(["Mexican", "American"].includes(r.cuisine ?? ""), r.dish);
  }
});

test("shared ingredients are bought once and reused", () => {
  const week = planWeek(pool, settings, []);
  const plan = summarize(week, 2, []);
  assert.ok(plan.meals.some((m) => m.reuses.length > 0), "at least one meal reuses earlier groceries");
  assert.equal(new Set(plan.groceries.map((g) => g.key)).size, plan.groceries.length);
  assert.ok(plan.used > 0 && plan.perPlate > 0 && plan.bill >= plan.used);
  // Pantry items aren't bought.
  const withPantry = summarize(week, 2, plan.groceries.slice(0, 2).map((g) => g.key));
  assert.ok(withPantry.bill < plan.bill);
});

test("swap returns a different dinner, or null when nothing fits", () => {
  const week = planWeek(pool, settings, []);
  const alt = swapMeal(week, 1, pool, settings, [], new Set());
  assert.ok(alt && !week.some((r) => r.id === alt.id));
  assert.equal(swapMeal(week, 0, week, settings, [], new Set()), null);
});

test("sides aren't dinners, and older recipes without package sizes are priced sensibly", async () => {
  const { eligible } = await import("./planner.ts");
  const side = { ...pool[0], id: "side", dish: "Garlic bread", meals: ["snack", "dinner"] as PlanRecipe["meals"] };
  assert.equal(eligible([side], settings).length, 0);
  // A recipe with no pack sizes, scaled from 2 to 6 people, costs about 3x one plate-set, not 3x every package.
  const old: PlanRecipe = { ...pool[0], id: "old", servings: 2, ingredients: pool[0].ingredients.map(({ pack_qty: _p, ...g }) => g) };
  const one = summarize([old], 2, []).used;
  const six = summarize([old], 6, []).used;
  assert.ok(six > one * 2.5 && six < one * 3.5, `${one} → ${six}`);
});

test("plans only dinners that fit your diets", () => {
  const veg: PlanRecipe[] = pool.map((r, i) => ({ ...r, diet_tags: i % 2 ? ["vegetarian"] : [], contains: i % 2 ? [] : ["meat"] }));
  const week = planWeek(veg, { ...settings, dinners: 3, diets: ["vegetarian"] }, []);
  assert.ok(week.length > 0);
  for (const r of week) assert.ok(r.diet_tags?.includes("vegetarian"), r.dish);
});
