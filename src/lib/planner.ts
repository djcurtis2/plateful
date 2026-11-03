// "Plan my week": picks breakfasts, lunches, dinners and snacks that share ingredients, like a restaurant planning its prep list.
// Pure functions shared by server and client; covered by planner.test.ts.
import { pantryKey } from "./format.ts";
import type { Ingredient, Recipe } from "./recipe.ts";
import { outPrice } from "./savings.ts";
import { fitsDiets } from "./diet.ts";

export type PlanRecipe = Pick<Recipe, "id" | "slug" | "dish" | "restaurant" | "style" | "source" | "cuisine" | "meals" | "servings" | "minutes" | "menu_price" | "plate_cost" | "image_url" | "ingredients"> & { out_price?: number | null; menu_serves?: number; diet_tags?: string[]; contains?: string[] };

export const PLAN_MEALS = ["breakfast", "lunch", "dinner", "snack"] as const;
export type PlanMeal = (typeof PLAN_MEALS)[number];
export const PLAN_MEAL_LABELS: Record<PlanMeal, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" };

export type PlanSettings = {
  days: number; // 3–7
  meals: PlanMeal[]; // which meals each day has
  servings: number; // people eating
  maxMinutes: number | null;
  cuisines: string[]; // empty = any; lunches and dinners only
  diets?: string[]; // from the cook's profile; only recipes tagged for every one of them
};

/**
 * One spot in the week. id null = empty (eating out, or not picked yet).
 * leftover = eat the most recent earlier cook of the same recipe (last night's dinner), so that one is cooked double.
 */
export type PlanSlot = { day: number; meal: PlanMeal; id: string | null; leftover?: boolean; made?: boolean };

type Stock = { name: string; aisle: Ingredient["aisle"]; unit: string; left: number; pack: number; packs: number; cost: number; measured: boolean };

export type GroceryLine = { key: string; name: string; aisle: Ingredient["aisle"]; buy: string; cost: number; usedBy: number };
/**
 * cost = the share of groceries this meal actually uses (a quarter of a block of butter counts as a quarter).
 * A dinner cooked double and its leftover lunch split the cost. leftoverFrom = the spot it was cooked in.
 */
export type PlannedMeal = { slot: PlanSlot; recipe: PlanRecipe | null; cost: number; reuses: string[]; leftoverFrom?: number };
export type Plan = {
  meals: PlannedMeal[];
  groceries: GroceryLine[];
  pantryUsed: string[];
  /** The shopping bill: whole packages. */
  bill: number;
  /** What the week's meals actually use; bill minus this is what's left in the fridge. */
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

/** Older plans stored { dinners } and only planned dinners. */
export function normalizeSettings(raw: Partial<PlanSettings> & { dinners?: number }): PlanSettings {
  const meals = (raw.meals ?? []).filter((m): m is PlanMeal => (PLAN_MEALS as readonly string[]).includes(m));
  return {
    days: Math.min(7, Math.max(1, raw.days ?? raw.dinners ?? 5)),
    meals: meals.length ? PLAN_MEALS.filter((m) => meals.includes(m)) : ["dinner"],
    servings: raw.servings ?? 2,
    maxMinutes: raw.maxMinutes ?? null,
    cuisines: raw.cuisines ?? [],
    diets: raw.diets ?? [],
  };
}

/** Every spot in the week, day by day, breakfast to snack. */
export function emptySlots(s: Pick<PlanSettings, "days" | "meals">): PlanSlot[] {
  const out: PlanSlot[] = [];
  for (let day = 0; day < s.days; day++) for (const meal of PLAN_MEALS) if (s.meals.includes(meal)) out.push({ day, meal, id: null });
  return out;
}

/** Older plans kept an ordered list of dinners, one a day. */
export function legacySlots(ids: string[]): PlanSlot[] {
  return ids.map((id, day) => ({ day, meal: "dinner", id }));
}

/**
 * Is this recipe tagged for the meal? A dinner isn't really a side, snack, dessert or drink (garlic bread can be "snack, dinner").
 * A drink is never a whole breakfast or lunch (an iced latte can be tagged "breakfast, drink"); it can be a snack if tagged one.
 */
export function fitsMeal(r: Pick<PlanRecipe, "meals">, meal: PlanMeal): boolean {
  if (meal === "dinner") return !r.meals.length || (r.meals.includes("dinner") && !r.meals.some((m) => m === "snack" || m === "dessert" || m === "drink"));
  if (meal === "snack") return r.meals.includes("snack");
  return r.meals.includes(meal) && !r.meals.includes("drink");
}

/** Recipes that suit a meal. Cuisine choices apply to lunches and dinners; breakfasts and snacks are too few to narrow. */
export function eligible(pool: PlanRecipe[], s: Omit<PlanSettings, "days" | "meals">, meal: PlanMeal = "dinner"): PlanRecipe[] {
  const seen = new Set<string>();
  return pool.filter((r) => {
    if (!r.ingredients?.length) return false;
    if (s.diets?.length && !fitsDiets({ diet_tags: r.diet_tags ?? [], contains: r.contains ?? [] }, s.diets)) return false;
    if (!fitsMeal(r, meal)) return false;
    if (s.maxMinutes && r.minutes && r.minutes > s.maxMinutes) return false;
    if ((meal === "dinner" || meal === "lunch") && s.cuisines.length && !s.cuisines.includes(r.cuisine ?? "")) return false;
    const k = sameDish(r);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Greedy: keeps adding the recipe that costs the least extra given what's already in the cart, with a nudge for variety. */
function pick(candidates: PlanRecipe[], n: number, servings: number, stock: Map<string, Stock>, pantry: Set<string>, taken: Set<string>, chosen: PlanRecipe[]) {
  const out: PlanRecipe[] = [];
  while (out.length < n) {
    let best: { r: PlanRecipe; score: number } | null = null;
    for (const r of candidates) {
      if (taken.has(sameDish(r))) continue;
      const { cost, reuses } = addRecipe(r, servings, stock, pantry, false);
      const repeats = [...chosen, ...out].filter((c) => c.cuisine && c.cuisine === r.cuisine).length;
      // Lower is better: extra dollars this meal adds, minus a bonus per reused ingredient, plus a variety penalty.
      const score = cost - reuses.length * 0.75 + repeats * repeats * 1.5;
      if (!best || score < best.score) best = { r, score };
    }
    if (!best) break; // not enough recipes: the spot stays empty for the cook to fill
    addRecipe(best.r, servings, stock, pantry, true);
    out.push(best.r);
    taken.add(sameDish(best.r));
  }
  return out;
}

/** Most different breakfasts or snacks in a week; after that they repeat, the way most people eat. */
export const ROTATE = 3;

/**
 * Plans the week. Dinners first (the biggest spend), then lunches, breakfasts and snacks, each choosing what
 * shares groceries with what's already in the cart. With dinners on, odd-day lunches are last night's leftovers
 * (cook double), and so is any lunch there aren't enough recipes for. Breakfasts and snacks rotate a few favorites.
 * Spots nothing fits stay empty. empty: true leaves every spot open except the recipes you asked for.
 */
export function planWeek(
  pool: PlanRecipe[],
  s: PlanSettings,
  pantryKeys: Iterable<string>,
  opts: { include?: PlanRecipe[]; exclude?: Set<string>; empty?: boolean } = {},
): PlanSlot[] {
  const pantry = new Set(pantryKeys);
  const stock = new Map<string, Stock>();
  const taken = new Set<string>();
  const picks = new Map<PlanMeal, PlanRecipe[]>(PLAN_MEALS.map((m) => [m, []]));
  for (const r of opts.include ?? []) {
    const m = (["dinner", "lunch", "breakfast", "snack"] as const).find((m) => s.meals.includes(m) && fitsMeal(r, m));
    if (!m || taken.has(sameDish(r))) continue;
    addRecipe(r, s.servings, stock, pantry, true);
    picks.get(m)!.push(r);
    taken.add(sameDish(r));
  }
  const withDinner = s.meals.includes("dinner");
  if (!opts.empty) {
    for (const meal of ["dinner", "lunch", "breakfast", "snack"] as const) {
      if (!s.meals.includes(meal)) continue;
      const want = meal === "dinner" ? s.days : meal === "lunch" ? (withDinner ? Math.ceil(s.days / 2) : s.days) : Math.min(ROTATE, s.days);
      const have = picks.get(meal)!;
      if (have.length >= want) continue;
      const candidates = eligible(pool, s, meal).filter((r) => !opts.exclude?.has(r.id));
      have.push(...pick(candidates, want - have.length, s.servings, stock, pantry, taken, [...picks.values()].flat()));
    }
  }

  // Day by day, so yesterday's dinner is already in place when today's lunch looks for leftovers.
  const slots = emptySlots(s);
  const next = new Map<PlanMeal, number>(PLAN_MEALS.map((m) => [m, 0]));
  for (const slot of slots) {
    const list = picks.get(slot.meal)!;
    const i = next.get(slot.meal)!;
    if (slot.meal === "lunch" && withDinner && !opts.empty) {
      const last = slots.find((x) => x.day === slot.day - 1 && x.meal === "dinner")?.id;
      if (last && (slot.day % 2 === 1 || i >= list.length)) {
        Object.assign(slot, { id: last, leftover: true });
        continue;
      }
    }
    if (i < list.length) {
      slot.id = list[i].id;
      next.set(slot.meal, i + 1);
    } else if (!opts.empty && slot.meal !== "dinner" && list.length) slot.id = list[slot.day % list.length].id; // repeat a favorite
  }
  return slots;
}

/** Rebuilds the week's costs, grocery list and leftovers for a set of spots. */
export function summarizeWeek(slots: PlanSlot[], byId: Map<string, PlanRecipe>, servings: number, pantryKeys: Iterable<string>): Plan {
  const pantry = new Set(pantryKeys);
  const stock = new Map<string, Stock>();
  const pantryUsed = new Set<string>();
  const usedBy = new Map<string, number>();
  // Where each leftover was cooked: the most recent earlier cook of the same recipe. -1 = not a leftover, or nothing to eat.
  const from = slots.map((x, i) => {
    if (!x.leftover || !x.id) return -1;
    for (let j = i - 1; j >= 0; j--) if (slots[j].id === x.id && !slots[j].leftover) return j;
    return -1;
  });
  const eaters = slots.map((_, i) => 1 + from.filter((f) => f === i).length);
  const meals: PlannedMeal[] = slots.map((slot) => ({ slot, recipe: slot.id ? (byId.get(slot.id) ?? null) : null, cost: 0, reuses: [] }));
  meals.forEach((m, i) => {
    if (!m.recipe || m.slot.leftover) return;
    const { used, reuses } = addRecipe(m.recipe, servings * eaters[i], stock, pantry, true);
    m.cost = Math.round((used / eaters[i]) * 100) / 100;
    m.reuses = reuses;
    for (const g of m.recipe.ingredients) {
      const k = pantryKey(g.name);
      if (pantry.has(k)) pantryUsed.add(g.name);
      if (g.price > 0 && !pantry.has(k)) usedBy.set(k, (usedBy.get(k) ?? 0) + 1);
    }
  });
  meals.forEach((m, i) => {
    if (!m.slot.leftover) return;
    if (from[i] < 0) m.recipe = null; // nothing was cooked earlier for it
    else Object.assign(m, { cost: meals[from[i]].cost, leftoverFrom: from[i] });
  });

  const filled = meals.filter((m) => m.recipe);
  const used = Math.round(filled.reduce((s, m) => s + m.cost, 0) * 100) / 100;
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
  const compared = filled.map((m) => ({ m, out: outPrice(m.recipe!) })).filter((x) => x.out);
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
  const plates = Math.max(1, filled.length * servings);
  const bill = Math.round(groceries.reduce((s, g) => s + g.cost, 0) * 100) / 100;
  return { meals, groceries, pantryUsed: [...pantryUsed], bill, used, perPlate: Math.round((used / plates) * 100) / 100, outVsHome, leftovers };
}

/** A plain list of dinners, one a day. */
export function summarize(dinners: PlanRecipe[], servings: number, pantryKeys: Iterable<string>): Plan {
  return summarizeWeek(legacySlots(dinners.map((r) => r.id)), new Map(dinners.map((r) => [r.id, r])), servings, pantryKeys);
}

/** The best new recipe for one spot, given the rest of the week. Never one already in the week. Null when nothing else fits. */
export function swapSlot(
  slots: PlanSlot[],
  index: number,
  byId: Map<string, PlanRecipe>,
  pool: PlanRecipe[],
  s: PlanSettings,
  pantryKeys: Iterable<string>,
  avoid: Set<string>,
): PlanRecipe | null {
  const pantry = new Set(pantryKeys);
  const stock = new Map<string, Stock>();
  const taken = new Set<string>();
  const others: PlanRecipe[] = [];
  slots.forEach((x, i) => {
    const r = x.id ? byId.get(x.id) : undefined;
    if (!r) return;
    taken.add(sameDish(r));
    if (i === index || x.leftover) return;
    addRecipe(r, s.servings, stock, pantry, true);
    others.push(r);
  });
  const candidates = eligible(pool, s, slots[index].meal).filter((r) => !avoid.has(r.id));
  return pick(candidates, 1, s.servings, stock, pantry, taken, others)[0] ?? null;
}

/** The recipe ids a set of spots uses, once each, for "Made it" lookups. */
export const slotIds = (slots: PlanSlot[]) => [...new Set(slots.map((x) => x.id).filter((id): id is string => !!id))];

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
