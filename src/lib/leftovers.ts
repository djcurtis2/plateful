// "Use it up": what a recipe leaves you with, and which other copycats use those leftovers.
// Pure functions shared by server and client; covered by leftovers.test.ts.
import { pantryKey } from "./format.ts";
import type { Ingredient } from "./recipe.ts";

export type Leftover = {
  name: string;
  key: string;
  /** Share of the package left after cooking, 0–1. */
  share: number;
  /** True when worked out from the package size; false when it's a best guess for older recipes. */
  measured: boolean;
  /** Rough dollar value of what's left. */
  value: number;
};

// Aisles where you usually buy more than one recipe needs (a jar, a bunch, a pack of tortillas).
const PARTIAL_AISLES = new Set(["Pantry", "International", "Dairy", "Produce", "Bakery", "Frozen"]);
const MIN_SHARE = 0.25; // ignore scraps
const GUESS_SHARE = 0.5;

/** Ingredients you'll have left after making this recipe once. Skips staples and things already in your pantry. */
export function leftoversFor(ingredients: Ingredient[], pantry: Iterable<string> = []): Leftover[] {
  const have = new Set(pantry);
  const out = new Map<string, Leftover>();
  for (const g of ingredients) {
    if (!(g.price > 0)) continue; // staples: salt, oil, water
    const key = pantryKey(g.name);
    if (!key || have.has(key)) continue;
    let share: number;
    let measured: boolean;
    if (g.pack_qty && g.pack_qty > 0 && g.qty > 0) {
      share = Math.max(0, Math.min(1, 1 - g.qty / g.pack_qty));
      measured = true;
    } else if (g.pack_qty === undefined && PARTIAL_AISLES.has(g.aisle) && g.price >= 1.5) {
      share = GUESS_SHARE; // older recipe without package sizes
      measured = false;
    } else continue;
    if (share < MIN_SHARE) continue;
    const value = Math.round(g.price * share * 100) / 100;
    const prev = out.get(key);
    if (!prev || prev.value < value) out.set(key, { name: g.name, key, share, measured, value });
  }
  return [...out.values()].sort((a, b) => b.value - a.value).slice(0, 8);
}

/** Does a recipe ingredient key match a leftover key? "chipotle in adobo" ≈ "chipotle pepper in adobo". */
function same(a: string, b: string) {
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= 4 && (` ${long} `.includes(` ${short} `));
}

export type Suggestion<R> = { recipe: R; uses: Leftover[]; value: number };

/** Other recipes ranked by how much of your leftovers they'd use up. */
export function useItUp<R extends { id: string; ingredients: Ingredient[] }>(leftovers: Leftover[], candidates: R[], excludeId: string, limit = 3): Suggestion<R>[] {
  if (!leftovers.length) return [];
  const seen = new Set<string>();
  const scored: Suggestion<R>[] = [];
  for (const r of candidates) {
    if (r.id === excludeId || seen.has(r.id)) continue;
    seen.add(r.id);
    const keys = r.ingredients.map((g) => pantryKey(g.name));
    const uses = leftovers.filter((l) => keys.some((k) => same(k, l.key)));
    if (uses.length) scored.push({ recipe: r, uses, value: Math.round(uses.reduce((s, l) => s + l.value, 0) * 100) / 100 });
  }
  return scored.sort((a, b) => b.value - a.value || b.uses.length - a.uses.length).slice(0, limit);
}

/** "most of", "about half of", "a little of". */
export function shareLabel(l: Pick<Leftover, "share" | "measured">) {
  if (!l.measured) return "likely some";
  if (l.share >= 0.7) return "most";
  if (l.share >= 0.4) return "about half";
  return "some";
}
