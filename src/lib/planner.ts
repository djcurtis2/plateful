// "Plan my week": picks dinners that share ingredients, like a restaurant planning its prep list.
// Pure functions shared by server and client; covered by planner.test.ts.
import { pantryKey } from "./format.ts";
import type { Ingredient, Recipe } from "./recipe.ts";
import { outPrice } from "./savings.ts";
import { fitsDiets } from "./diet.ts";

export type PlanRecipe = Pick<Recipe, "id" | "slug" | "dish" | "restaurant" | "style" | "source" | "cuisine" | "meals" | "servings" | "minutes" | "menu_price" | "plate_cost" | "image_url" | "ingredients"> & { out_price?: number | null; menu_serves?: number; diet_tags?: string[]; contains?: string[] };

export type PlanSettings = {
  dinners: number; // 3–7
  servings: number; // people eating
  maxMinutes: number | null;
  cuisines: string[]; // empty = any
  diets?: string[]; // from the cook's profile; only dinners tagged for every one of them
};

type Stock = { name: string; aisle: Ingredient["aisle"]; unit: string; left: number; pack: number; packs: number; cost: number; measured: boolean };

export type GroceryLine = { key: string; name: string; aisle: Ingredient["aisle"]; buy: string; cost: number; usedBy: number };
/** cost = the share of groceries this meal actually uses (a quarter of a block of butter counts as a quarter). */
export type PlannedMeal = { recipe: PlanRecipe; cost: number; reuses: string[] };
export type Plan = {
  meals: PlannedMeal[];
  groceries: GroceryLine[];
  pantryUsed: string[];
  /** The shopping bill: whole packages. */
  bill: number;
  /** What the week's dinners actually use; bill minus this is what's left in the fridge. */
  used: number;
  perPlate: number;
  /** What the week would cost eating out (menu prices for copycats, similar takeout for the rest) vs. at home. */
  outVsHome: { dishes: number; out: number; home: number; copycats: number } | null;
  /** What's left at the end of the week. perishable = use it soon (produce, dairy, meat, bakery). */
  leftovers: { name: string; share: number; perishable: boolean }[];
};

const PERISHABLE = new Set(["Produce", "Dairy", "Meat", "Seafood", "Bakery"]);

/** The cost to add one recipe to what's already been bought this week (mutates `stock` when commit is true). */
function addRecipe(r: PlanRecipe, servings: number, stock: Map<string, Stock>, pantry: Set<string>, commit: boolean) {
  const scale = servings / Math.max(1, r.servings);
  let cost = 0; // extra money spent at the store for this recipe
  let used = 0; // value of what this recipe consumes
  const reuses: string[] = [];
  const touched = new Map<string, Stock>();
  for (const g of r.ingredients) {
    if (!(g.price > 0)) continue; // staples
    const key = pantryKey(g.name);
    if (!key || pantry.has(key)) continue;
    const need = g.qty * scale;
    const cur = touched.get(key) ?? stock.get(key);
    const s: Stock = cur ? { ...cur } : { name: g.name, aisle: g.aisle, unit: g.unit, left: 0, pack: g.pack_qty ?? 0, packs: 0, cost: 0, measured: !!g.pack_qty };
    const sameUnit = s.unit.trim().toLowerCase() === g.unit.trim().toLowerCase();
    // Older recipes have no package size: assume one package covers the recipe as written, with a little spare
    // (the same rule the recipe page's cart uses). Meat and seafood are bought by weight.
    const pack = g.pack_qty ?? (g.aisle === "Meat" || g.aisle === "Seafood" || !(g.qty > 0) ? 0 : g.qty / 0.75);
    if (pack > 0 && need > 0) {
      used += g.price * (need / pack);
      if (cur && sameUnit && s.left >= need) {
        s.left -= need;
        reuses.push(g.name);
      } else if (cur && !sameUnit && s.left > 0.25 * s.pack) {
        s.left = s.left / 2; // different units: assume it covers this and uses about half of what's left
        reuses.push(g.name);
      } else {
        const short = Math.max(0, need - (sameUnit ? s.left : 0));
        const n = Math.max(1, Math.ceil(short / pack));
        if (cur && s.left > 0) reuses.push(g.name);
        s.packs += n;
        s.pack = pack;
        s.left = (sameUnit ? s.left : 0) + n * pack - need;
        cost += n * g.price;
        s.cost += n * g.price;
        s.measured = true;
      }
    } else {
      // Bought by weight or exactly what's used (chicken by the pound): pay for what this recipe uses.
      const c = g.price * Math.max(scale, 0.25);
      cost += c;
      used += c;
      s.cost += c;
      s.packs += scale;
    }
    touched.set(key, s);
  }
  // Without package sizes we can't tell how much of each package a meal eats, so trust the recipe's own
  // per-plate estimate for the meal's cost (the shopping bill above is still whole packages).
  if (r.plate_cost && r.ingredients.some((g) => g.price > 0 && g.pack_qty === undefined)) used = r.plate_cost * servings;
  if (commit) for (const [k, v] of touched) stock.set(k, v);
  return { cost: Math.round(cost * 100) / 100, used: Math.round(used * 100) / 100, reuses };
}

const sameDish = (r: Pick<PlanRecipe, "dish" | "restaurant">) => `${r.restaurant ?? ""}|${r.dish}`.toLowerCase();

export function eligible(pool: PlanRecipe[], s: PlanSettings): PlanRecipe[] {
  const seen = new Set<string>();
  return pool.filter((r) => {
    if (!r.ingredients?.length) return false;
    if (s.diets?.length && !fitsDiets({ diet_tags: r.diet_tags ?? [], contains: r.contains ?? [] }, s.diets)) return false;
    // A dinner is tagged dinner and isn't really a side, snack, dessert or drink (garlic bread can be "snack, dinner").
    if (r.meals.length && (!r.meals.includes("dinner") || r.meals.some((m) => m === "snack" || m === "dessert" || m === "drink"))) return false;
    if (s.maxMinutes && r.minutes && r.minutes > s.maxMinutes) return false;
    if (s.cuisines.length && !s.cuisines.includes(r.cuisine ?? "")) return false;
    const k = sameDish(r);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Rebuilds the week's costs, grocery list and leftovers for a fixed list of meals. */
export function summarize(meals: PlanRecipe[], servings: number, pantryKeys: Iterable<string>): Plan {
  const pantry = new Set(pantryKeys);
  const stock = new Map<string, Stock>();
  const planned: PlannedMeal[] = [];
  const pantryUsed = new Set<string>();
  const usedBy = new Map<string, number>();
  for (const r of meals) {
    const { used, reuses } = addRecipe(r, servings, stock, pantry, true);
    planned.push({ recipe: r, cost: used, reuses });
    for (const g of r.ingredients) {
      const k = pantryKey(g.name);
      if (pantry.has(k)) pantryUsed.add(g.name);
      if (g.price > 0 && !pantry.has(k)) usedBy.set(k, (usedBy.get(k) ?? 0) + 1);
    }
  }
  const used = Math.round(planned.reduce((s, m) => s + m.cost, 0) * 100) / 100;
  const groceries: GroceryLine[] = [...stock.entries()]
    .map(([key, s]) => ({
      key,
      name: s.name,
      aisle: s.aisle,
      buy: s.measured ? `${s.packs} ${s.packs === 1 ? "pack" : "packs"}` : `${Math.round(s.packs * 100) / 100}× recipe amount`,
      cost: Math.round(s.cost * 100) / 100,
      usedBy: usedBy.get(key) ?? 1,
    }))
    .sort((a, b) => a.aisle.localeCompare(b.aisle) || a.name.localeCompare(b.name));
  const compared = planned.map((m) => ({ m, out: outPrice(m.recipe) })).filter((x) => x.out);
  const outVsHome = compared.length
    ? {
        dishes: compared.length,
        copycats: compared.filter((x) => x.out!.compare === "menu").length,
        out: Math.round(compared.reduce((s, x) => s + x.out!.price * servings, 0) * 100) / 100,
        home: Math.round(compared.reduce((s, x) => s + x.m.cost, 0) * 100) / 100,
      }
    : null;
  const leftovers = [...stock.values()]
    .filter((s) => s.measured && s.pack > 0 && s.left / (s.pack * Math.max(1, s.packs)) >= 0.25)
    .map((s) => ({ name: s.name, share: s.left / (s.pack * Math.max(1, s.packs)), perishable: PERISHABLE.has(s.aisle) }))
    .sort((a, b) => Number(b.perishable) - Number(a.perishable) || b.share - a.share)
    .slice(0, 10);
  const plates = Math.max(1, meals.length * servings);
  const bill = Math.round(groceries.reduce((s, g) => s + g.cost, 0) * 100) / 100;
  return { meals: planned, groceries, pantryUsed: [...pantryUsed], bill, used, perPlate: Math.round((used / plates) * 100) / 100, outVsHome, leftovers };
}

/**
 * Greedy week planner: starts from the meals you must include, then keeps adding the dinner
 * that costs the least extra given what's already in the cart, with a nudge for variety.
 */
export function planWeek(pool: PlanRecipe[], s: PlanSettings, pantryKeys: Iterable<string>, opts: { include?: PlanRecipe[]; exclude?: Set<string> } = {}): PlanRecipe[] {
  const pantry = new Set(pantryKeys);
  const chosen: PlanRecipe[] = [];
  const stock = new Map<string, Stock>();
  const taken = new Set<string>();
  for (const r of opts.include ?? []) {
    if (chosen.length >= s.dinners || taken.has(sameDish(r))) continue;
    addRecipe(r, s.servings, stock, pantry, true);
    chosen.push(r);
    taken.add(sameDish(r));
  }
  const candidates = eligible(pool, s).filter((r) => !opts.exclude?.has(r.id));
  while (chosen.length < s.dinners) {
    let best: { r: PlanRecipe; score: number } | null = null;
    for (const r of candidates) {
      if (taken.has(sameDish(r))) continue;
      const { cost, reuses } = addRecipe(r, s.servings, stock, pantry, false);
      const repeats = chosen.filter((c) => c.cuisine && c.cuisine === r.cuisine).length;
      // Lower is better: extra dollars this meal adds, minus a bonus per reused ingredient, plus a variety penalty.
      const score = cost - reuses.length * 0.75 + repeats * repeats * 1.5;
      if (!best || score < best.score) best = { r, score };
    }
    if (!best) break; // not enough recipes: caller can fill the gap
    addRecipe(best.r, s.servings, stock, pantry, true);
    chosen.push(best.r);
    taken.add(sameDish(best.r));
  }
  return chosen;
}

/** Swap one meal for the best alternative that fits with the rest of the week. */
export function swapMeal(current: PlanRecipe[], index: number, pool: PlanRecipe[], s: PlanSettings, pantryKeys: Iterable<string>, avoid: Set<string>): PlanRecipe | null {
  const others = current.filter((_, i) => i !== index);
  const exclude = new Set([...avoid, ...current.map((r) => r.id)]);
  const next = planWeek(pool, { ...s, dinners: others.length + 1 }, pantryKeys, { include: others, exclude });
  return next.length > others.length ? next[next.length - 1] : null;
}

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
