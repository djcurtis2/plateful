// Savings: what cooking at home saved vs. eating the same thing out. Pure; covered by savings.test.ts.
// Copycats compare against the restaurant's menu price. Other recipes compare against a similar takeout
// dish (Claude's per-recipe estimate), or a conservative average for that meal when there's no estimate.
import type { Meal, Recipe } from "./recipe.ts";

/** Conservative US takeout price per plate when a recipe has no menu price or estimate. */
export const AVERAGE_OUT: Record<Meal, number> = { breakfast: 10, lunch: 12, dinner: 15, dessert: 7, snack: 7, drink: 5 };

export type Compare = "menu" | "similar" | "average";
type Priced = Pick<Recipe, "menu_price" | "plate_cost" | "meals"> & { out_price?: number | null; menu_serves?: number | null };

/** What one plate of this costs eating out. */
export function outPrice(r: Priced): { price: number; compare: Compare } | null {
  if (r.menu_price) return { price: Math.round((r.menu_price / Math.max(1, r.menu_serves ?? 1)) * 100) / 100, compare: "menu" };
  if (r.out_price) return { price: r.out_price, compare: "similar" };
  const meal = (["dinner", "lunch", "breakfast", "dessert", "snack", "drink"] as Meal[]).find((m) => r.meals.includes(m));
  return meal ? { price: AVERAGE_OUT[meal], compare: "average" } : null;
}

export const COMPARE_LABEL: Record<Compare, string> = { menu: "menu price", similar: "similar takeout", average: "average takeout" };

/** Savings for cooking a recipe once for `servings` people. Null when there's nothing honest to compare to. */
export function savingsFor(r: Priced, servings: number) {
  const out = outPrice(r);
  if (!out || !r.plate_cost) return null;
  const people = Math.max(1, Math.min(8, Math.round(servings)));
  const home = Math.round(r.plate_cost * people * 100) / 100;
  const outCost = Math.round(out.price * people * 100) / 100;
  return { servings: people, home, out: outCost, saved: Math.max(0, Math.round((outCost - home) * 100) / 100), compare: out.compare };
}

export const SAVINGS_MILESTONES = [
  { badge: "saved_100", amount: 100 },
  { badge: "saved_500", amount: 500 },
  { badge: "saved_1000", amount: 1000 },
  { badge: "saved_5000", amount: 5000 },
  { badge: "saved_10000", amount: 10000 },
] as const;

/** Next milestone to aim for and how far along you are. */
export function nextMilestone(saved: number) {
  const next = SAVINGS_MILESTONES.find((m) => saved < m.amount) ?? null;
  const prev = [...SAVINGS_MILESTONES].reverse().find((m) => saved >= m.amount)?.amount ?? 0;
  return next ? { amount: next.amount, toGo: Math.round((next.amount - saved) * 100) / 100, progress: (saved - prev) / (next.amount - prev) } : null;
}

/** "$1,240" / "$12.5k" for compact display. */
export function dollars(n: number, compact = false) {
  if (compact && n >= 10000) return `$${(Math.floor(n / 100) / 10).toLocaleString("en-US")}k`;
  return `$${Math.round(n).toLocaleString("en-US")}`;
}
