// "Build a plate": pick a protein, a way to cook it and a flavor; we suggest add-ins and sides that go with it.
// Pure and fixed (no Claude until the cook taps "Make my recipe"); covered by builder.test.ts.

export type Option = { id: string; label: string; emoji?: string };

export const PROTEINS = [
  { id: "chicken-breast", label: "Chicken breast", emoji: "🍗", methods: ["skillet", "sheet-pan", "air-fryer", "grill"], flavors: ["lemon-herb", "garlic-butter", "cajun", "pesto"] },
  { id: "chicken-thighs", label: "Chicken thighs", emoji: "🍗", methods: ["sheet-pan", "skillet", "air-fryer", "slow-cooker"], flavors: ["honey-garlic", "teriyaki", "curry", "bbq"] },
  { id: "ground-beef", label: "Ground beef", emoji: "🥩", methods: ["skillet", "oven", "slow-cooker"], flavors: ["tex-mex", "mediterranean", "bbq", "teriyaki"] },
  { id: "steak", label: "Steak", emoji: "🥩", methods: ["skillet", "grill", "air-fryer"], flavors: ["garlic-butter", "teriyaki", "tex-mex", "lemon-herb"] },
  { id: "pork-chops", label: "Pork chops", emoji: "🐖", methods: ["skillet", "oven", "grill", "air-fryer"], flavors: ["honey-garlic", "bbq", "cajun", "garlic-butter"] },
  { id: "ground-turkey", label: "Ground turkey", emoji: "🦃", methods: ["skillet", "stir-fry", "oven"], flavors: ["tex-mex", "teriyaki", "mediterranean", "curry"] },
  { id: "salmon", label: "Salmon", emoji: "🐟", methods: ["sheet-pan", "air-fryer", "skillet", "grill"], flavors: ["teriyaki", "lemon-herb", "honey-garlic", "pesto"] },
  { id: "white-fish", label: "White fish", emoji: "🐟", methods: ["oven", "skillet", "air-fryer"], flavors: ["lemon-herb", "cajun", "tex-mex", "garlic-butter"] },
  { id: "shrimp", label: "Shrimp", emoji: "🦐", methods: ["skillet", "stir-fry", "grill", "sheet-pan"], flavors: ["garlic-butter", "cajun", "teriyaki", "tex-mex"] },
  { id: "tofu", label: "Tofu", emoji: "🌱", methods: ["air-fryer", "stir-fry", "sheet-pan"], flavors: ["teriyaki", "curry", "honey-garlic", "bbq"] },
  { id: "chickpeas", label: "Chickpeas", emoji: "🫘", methods: ["sheet-pan", "skillet", "slow-cooker"], flavors: ["curry", "mediterranean", "lemon-herb", "tex-mex"] },
  { id: "eggs", label: "Eggs", emoji: "🥚", methods: ["skillet", "oven"], flavors: ["mediterranean", "tex-mex", "pesto", "garlic-butter"] },
] as const;

export const METHODS = [
  { id: "skillet", label: "Skillet", emoji: "🍳" },
  { id: "sheet-pan", label: "Sheet pan", emoji: "🧑‍🍳" },
  { id: "air-fryer", label: "Air fryer", emoji: "💨" },
  { id: "grill", label: "Grill", emoji: "🔥" },
  { id: "oven", label: "Oven-baked", emoji: "♨️" },
  { id: "stir-fry", label: "Stir-fry", emoji: "🥢" },
  { id: "slow-cooker", label: "Slow cooker", emoji: "🍲" },
] as const;

export const FLAVORS = [
  {
    id: "lemon-herb", label: "Lemon herb", emoji: "🍋",
    addIns: ["Lemon", "Garlic", "Fresh parsley", "Dried oregano", "Olive oil", "Capers", "Shallot", "Dijon mustard"],
    sides: ["Roasted potatoes", "Green beans", "Rice pilaf", "Simple salad"],
  },
  {
    id: "garlic-butter", label: "Garlic butter", emoji: "🧄",
    addIns: ["Butter", "Garlic", "Fresh parsley", "Parmesan", "Red pepper flakes", "Lemon", "Thyme", "Mushrooms"],
    sides: ["Mashed potatoes", "Roasted broccoli", "Garlic bread", "Asparagus"],
  },
  {
    id: "teriyaki", label: "Teriyaki", emoji: "🥢",
    addIns: ["Soy sauce", "Ginger", "Garlic", "Honey", "Sesame seeds", "Green onions", "Rice vinegar", "Bell pepper"],
    sides: ["Steamed rice", "Stir-fried broccoli", "Cucumber salad", "Fried rice"],
  },
  {
    id: "tex-mex", label: "Tex-Mex", emoji: "🌮",
    addIns: ["Cumin", "Chili powder", "Lime", "Onion", "Black beans", "Corn", "Salsa", "Cilantro", "Jalapeño"],
    sides: ["Mexican rice", "Tortillas", "Corn salad", "Refried beans"],
  },
  {
    id: "mediterranean", label: "Mediterranean", emoji: "🫒",
    addIns: ["Feta", "Olives", "Cherry tomatoes", "Cucumber", "Red onion", "Oregano", "Lemon", "Garlic", "Spinach"],
    sides: ["Couscous", "Pita bread", "Greek salad", "Hummus"],
  },
  {
    id: "bbq", label: "BBQ", emoji: "🍖",
    addIns: ["BBQ sauce", "Smoked paprika", "Brown sugar", "Onion", "Apple cider vinegar", "Garlic powder"],
    sides: ["Coleslaw", "Corn on the cob", "Baked beans", "Mac and cheese"],
  },
  {
    id: "curry", label: "Curry", emoji: "🍛",
    addIns: ["Curry powder", "Coconut milk", "Onion", "Garlic", "Ginger", "Spinach", "Canned tomatoes", "Cilantro"],
    sides: ["Basmati rice", "Naan", "Roasted cauliflower", "Cucumber yogurt"],
  },
  {
    id: "cajun", label: "Cajun", emoji: "🌶️",
    addIns: ["Cajun seasoning", "Bell pepper", "Onion", "Celery", "Garlic", "Andouille sausage", "Hot sauce"],
    sides: ["Dirty rice", "Cornbread", "Collard greens", "Corn on the cob"],
  },
  {
    id: "pesto", label: "Pesto", emoji: "🌿",
    addIns: ["Basil pesto", "Cherry tomatoes", "Parmesan", "Mozzarella", "Spinach", "Pine nuts", "Garlic"],
    sides: ["Pasta", "Caprese salad", "Roasted zucchini", "Crusty bread"],
  },
  {
    id: "honey-garlic", label: "Honey garlic", emoji: "🍯",
    addIns: ["Honey", "Garlic", "Soy sauce", "Butter", "Red pepper flakes", "Green onions", "Lime"],
    sides: ["Steamed rice", "Roasted carrots", "Green beans", "Mashed sweet potatoes"],
  },
] as const;

/** Sides that go with almost anything, offered after the flavor's own picks. */
export const EVERYDAY_SIDES = ["Roasted vegetables", "Side salad", "Steamed rice", "Baked potato", "Quinoa", "Crusty bread"];

export const MAX_ADD_INS = 6;
export const MAX_SIDES = 2;
export const MAX_NOTE = 80;

export type ProteinId = (typeof PROTEINS)[number]["id"];
export type MethodId = (typeof METHODS)[number]["id"];
export type FlavorId = (typeof FLAVORS)[number]["id"];

export const PROTEIN_BY_ID = Object.fromEntries(PROTEINS.map((p) => [p.id, p])) as Record<string, (typeof PROTEINS)[number] | undefined>;
export const METHOD_BY_ID = Object.fromEntries(METHODS.map((m) => [m.id, m])) as Record<string, (typeof METHODS)[number] | undefined>;
export const FLAVOR_BY_ID = Object.fromEntries(FLAVORS.map((f) => [f.id, f])) as Record<string, (typeof FLAVORS)[number] | undefined>;

/** Methods and flavors for a protein, the ones that suit it best first (marked `good`). Every option stays pickable. */
export function rankFor(protein: string | null): { methods: (Option & { good: boolean })[]; flavors: (Option & { good: boolean })[] } {
  const p = protein ? PROTEIN_BY_ID[protein] : undefined;
  // Best picks in the protein's own order (its first pick is the one we'd suggest), then the rest in list order.
  const order = <T extends Option>(list: readonly T[], best: readonly string[]) => {
    const good = new Set(best);
    const first = best.map((id) => list.find((o) => o.id === id)).filter((o): o is T => !!o);
    return [...first, ...list.filter((o) => !good.has(o.id))].map((o) => ({ id: o.id, label: o.label, emoji: o.emoji, good: good.has(o.id) }));
  };
  return { methods: order(METHODS, p?.methods ?? []), flavors: order(FLAVORS, p?.flavors ?? []) };
}

/** Add-ins and sides that go with a flavor. Sides: the flavor's own, then everyday ones, no repeats. */
export function suggestionsFor(flavor: string | null): { addIns: string[]; sides: string[] } {
  const f = flavor ? FLAVOR_BY_ID[flavor] : undefined;
  if (!f) return { addIns: [], sides: [...EVERYDAY_SIDES] };
  const sides = [...f.sides, ...EVERYDAY_SIDES.filter((s) => !(f.sides as readonly string[]).includes(s))];
  return { addIns: [...f.addIns], sides };
}

/** True when a suggestion is already in the cook's pantry (loose match: "Garlic" matches "garlic cloves"). */
export function inPantry(item: string, pantry: string[]): boolean {
  const want = item.toLowerCase();
  return pantry.some((p) => {
    const have = p.toLowerCase().trim();
    return have.length > 2 && (have.includes(want) || want.includes(have));
  });
}

export type Build = {
  protein: ProteinId;
  method: MethodId;
  flavor: FlavorId;
  addIns: string[];
  sides: string[];
  servings: number;
  note: string;
};

/**
 * Checks a build from the browser: protein, method and flavor must be known; add-ins and sides must come from
 * our suggestions for that flavor (so nothing free-form reaches Claude except the short note). Returns null if invalid.
 */
export function cleanBuild(raw: { protein?: unknown; method?: unknown; flavor?: unknown; addIns?: unknown; sides?: unknown; servings?: unknown; note?: unknown }): Build | null {
  const protein = typeof raw.protein === "string" && PROTEIN_BY_ID[raw.protein] ? (raw.protein as ProteinId) : null;
  const method = typeof raw.method === "string" && METHOD_BY_ID[raw.method] ? (raw.method as MethodId) : null;
  const flavor = typeof raw.flavor === "string" && FLAVOR_BY_ID[raw.flavor] ? (raw.flavor as FlavorId) : null;
  if (!protein || !method || !flavor) return null;
  const s = suggestionsFor(flavor);
  const pick = (v: unknown, allowed: string[], max: number) =>
    [...new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && allowed.includes(x)) : [])].slice(0, max);
  const n = Number(raw.servings);
  const servings = Number.isFinite(n) ? Math.min(8, Math.max(1, Math.round(n))) : 2;
  const note = typeof raw.note === "string" ? raw.note.replace(/\s+/g, " ").trim().slice(0, MAX_NOTE) : "";
  return { protein, method, flavor, addIns: pick(raw.addIns, s.addIns, MAX_ADD_INS), sides: pick(raw.sides, s.sides, MAX_SIDES), servings, note };
}

/** A plain-English summary of the build, shown on the page and sent to Claude. */
export function describeBuild(b: Build): string {
  const p = PROTEIN_BY_ID[b.protein]!.label.toLowerCase();
  const m = METHOD_BY_ID[b.method]!.label.toLowerCase();
  const f = FLAVOR_BY_ID[b.flavor]!.label.toLowerCase();
  const withs = b.addIns.length ? ` with ${listJoin(b.addIns.map((a) => a.toLowerCase()))}` : "";
  const sides = b.sides.length ? `, served with ${listJoin(b.sides.map((x) => x.toLowerCase()))}` : "";
  return `${f} ${p}, ${m}${withs}${sides}`;
}

function listJoin(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
