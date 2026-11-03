import { test } from "node:test";
import assert from "node:assert/strict";
import { eligible, legacySlots, normalizeSettings, planWeek, summarize, summarizeWeek, swapSlot, type PlanRecipe, type PlanSettings } from "./planner.ts";
import { SAMPLES } from "./samples.ts";

const pool: PlanRecipe[] = SAMPLES.map((s, i) => ({ ...s, id: `id${i}`, source: "snap", image_url: null }));
const byId = new Map(pool.map((r) => [r.id, r]));
const settings: PlanSettings = { days: 5, meals: ["dinner"], servings: 2, maxMinutes: null, cuisines: [] };
const allMeals: PlanSettings = { ...settings, days: 7, meals: ["breakfast", "lunch", "dinner", "snack"] };
const dinners = (slots: { id: string | null }[]) => slots.map((x) => byId.get(x.id!)!);

test("plans the right number of distinct dinners", () => {
  const week = planWeek(pool, settings, []);
  assert.equal(week.length, 5);
  assert.equal(new Set(week.map((r) => r.id)).size, 5);
  for (const r of dinners(week)) assert.ok(!r.meals.length || r.meals.includes("dinner"), r.dish);
});

test("respects time and cuisine limits, and includes what you asked for", () => {
  const tacos = pool.find((r) => r.slug.startsWith("weeknight-chipotle"))!;
  const week = dinners(planWeek(pool, { ...settings, days: 3, maxMinutes: 30, cuisines: ["Mexican", "American"] }, [], { include: [tacos] }).filter((x) => x.id));
  assert.equal(week[0].id, tacos.id);
  for (const r of week) {
    assert.ok((r.minutes ?? 0) <= 30 || r.id === tacos.id, r.dish);
    assert.ok(["Mexican", "American"].includes(r.cuisine ?? ""), r.dish);
  }
});

test("shared ingredients are bought once and reused", () => {
  const week = dinners(planWeek(pool, settings, []));
  const plan = summarize(week, 2, []);
  assert.ok(plan.meals.some((m) => m.reuses.length > 0), "at least one meal reuses earlier groceries");
  assert.equal(new Set(plan.groceries.map((g) => g.key)).size, plan.groceries.length);
  assert.ok(plan.used > 0 && plan.perPlate > 0 && plan.bill >= plan.used);
  // Pantry items aren't bought.
  const withPantry = summarize(week, 2, plan.groceries.slice(0, 2).map((g) => g.key));
  assert.ok(withPantry.bill < plan.bill);
});

test("swap returns something not already in the week, or null when nothing fits", () => {
  const week = planWeek(pool, settings, []);
  const alt = swapSlot(week, 1, byId, pool, settings, [], new Set());
  assert.ok(alt && !week.some((x) => x.id === alt.id));
  assert.equal(swapSlot(week, 0, byId, dinners(week), settings, [], new Set()), null);
});

test("sides aren't dinners, and older recipes without package sizes are priced sensibly", () => {
  const side = { ...pool[0], id: "side", dish: "Garlic bread", meals: ["snack", "dinner"] as PlanRecipe["meals"] };
  assert.equal(eligible([side], settings).length, 0);
  assert.equal(eligible([side], settings, "snack").length, 1);
  // A recipe with no pack sizes, scaled from 2 to 6 people, costs about 3x one plate-set, not 3x every package.
  const old: PlanRecipe = { ...pool[0], id: "old", servings: 2, ingredients: pool[0].ingredients.map(({ pack_qty: _p, ...g }) => g) };
  const one = summarize([old], 2, []).used;
  const six = summarize([old], 6, []).used;
  assert.ok(six > one * 2.5 && six < one * 3.5, `${one} → ${six}`);
});

test("plans only recipes that fit your diets", () => {
  const veg: PlanRecipe[] = pool.map((r, i) => ({ ...r, diet_tags: i % 2 ? ["vegetarian"] : [], contains: i % 2 ? [] : ["meat"] }));
  const vegById = new Map(veg.map((r) => [r.id, r]));
  const week = planWeek(veg, { ...allMeals, diets: ["vegetarian"] }, []).filter((x) => x.id);
  assert.ok(week.length > 0);
  for (const x of week) assert.ok(vegById.get(x.id!)!.diet_tags?.includes("vegetarian"), x.id!);
});

test("a full week: every meal each day, the right kind of recipe in each spot", () => {
  const week = planWeek(pool, allMeals, []);
  assert.equal(week.length, 28);
  for (const x of week.filter((x) => x.id && !x.leftover)) assert.ok(byId.get(x.id!)!.meals.includes(x.meal) || x.meal === "dinner", `${x.meal}: ${x.id}`);
  // Dinners never repeat.
  const d = week.filter((x) => x.meal === "dinner" && x.id).map((x) => x.id);
  assert.equal(new Set(d).size, d.length);
  // Breakfasts rotate a few favorites rather than leaving days empty.
  const b = week.filter((x) => x.meal === "breakfast");
  assert.ok(b.every((x) => x.id));
  assert.ok(new Set(b.map((x) => x.id)).size <= 3);
});

test("odd-day lunches are last night's dinner, cooked double, and split its cost", () => {
  const week = planWeek(pool, allMeals, []);
  const tue = week.find((x) => x.day === 1 && x.meal === "lunch")!;
  const monDinner = week.find((x) => x.day === 0 && x.meal === "dinner")!;
  assert.equal(tue.leftover, true);
  assert.equal(tue.id, monDinner.id);
  const plan = summarizeWeek(week, byId, 2, []);
  const i = week.indexOf(tue);
  const j = week.indexOf(monDinner);
  assert.equal(plan.meals[i].leftoverFrom, j);
  assert.equal(plan.meals[i].cost, plan.meals[j].cost);
  // Cooking double costs less per plate than cooking it once and buying lunch separately would.
  const once = summarize([byId.get(monDinner.id!)!], 2, []).used;
  assert.ok(plan.meals[j].cost * 2 < once * 2 + 0.01 && plan.meals[j].cost > 0);
});

test("pick-it-yourself weeks start empty except what you asked for", () => {
  const tacos = pool.find((r) => r.slug.startsWith("weeknight-chipotle"))!;
  const week = planWeek(pool, allMeals, [], { empty: true, include: [tacos] });
  assert.equal(week.filter((x) => x.id).length, 1);
  assert.equal(week.find((x) => x.id)!.meal, "dinner");
  const plan = summarizeWeek(week, byId, 2, []);
  assert.equal(plan.meals.filter((m) => m.recipe).length, 1);
});

test("older plans still read: { dinners } settings and a list of ids", () => {
  const s = normalizeSettings({ dinners: 4, servings: 3, maxMinutes: null, cuisines: [] } as never);
  assert.equal(s.days, 4);
  assert.deepEqual(s.meals, ["dinner"]);
  const slots = legacySlots(["id1", "id2"]);
  assert.deepEqual(slots.map((x) => [x.day, x.meal]), [[0, "dinner"], [1, "dinner"]]);
  // A leftover with nothing cooked before it counts as an empty spot.
  const plan = summarizeWeek([{ day: 0, meal: "lunch", id: "id1", leftover: true }], byId, 2, []);
  assert.equal(plan.meals[0].recipe, null);
  assert.equal(plan.used, 0);
});
