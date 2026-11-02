import { z } from "zod";
import { CONTAINS, type Diet } from "./diet.ts";

export const AISLES = [
  "Produce",
  "Meat",
  "Seafood",
  "Dairy",
  "Pantry",
  "Frozen",
  "Bakery",
  "International",
  "Beer & wine",
  "Other",
] as const;

export const IngredientSchema = z.object({
  name: z.string().trim().min(1).max(80),
  qty: z.coerce.number().min(0).max(1000).catch(0),
  unit: z.string().trim().max(20).catch(""),
  aisle: z.enum(AISLES).catch("Other"),
  // Typical US price of the package you'd buy, USD. 0 for staples like salt and oil.
  price: z.coerce.number().min(0).max(200).catch(0),
  // How much comes in that package, in the same unit as qty. 0 = unknown or you buy exactly what's needed.
  pack_qty: z.coerce.number().min(0).max(10000).catch(0).optional(),
});
export type Ingredient = z.infer<typeof IngredientSchema>;

export const MEALS = ["breakfast", "lunch", "dinner", "dessert", "snack", "drink"] as const;
export type Meal = (typeof MEALS)[number];
export const MEAL_LABELS: Record<Meal, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  dessert: "Dessert",
  snack: "Snacks & sides",
  drink: "Drinks",
};

/** What the recognition model returns. Lenient on optional fields so one odd value doesn't fail a scan. */
export const RecognizedSchema = z.object({
  is_food: z.boolean(),
  reason: z.string().max(300).nullable().optional().catch(null),
  dish: z.string().trim().transform((d) => d.slice(0, 90)).optional().catch(undefined),
  cuisine: z.string().trim().max(60).optional().catch(undefined),
  meals: z
    .array(z.string())
    .transform((m) => [...new Set(m.map((x) => x.toLowerCase()).filter((x): x is Meal => (MEALS as readonly string[]).includes(x)))])
    .optional()
    .catch([]),
  restaurant: z.string().trim().max(80).nullable().optional().catch(null),
  servings: z.coerce.number().int().min(1).max(24).catch(2).optional(),
  minutes: z.coerce.number().int().min(1).max(1440).catch(30).optional(),
  difficulty: z.enum(["Easy", "Medium", "Hard"]).catch("Easy").optional(),
  confidence: z.coerce.number().min(0).max(1).catch(0.7).optional(),
  why: z.string().max(300).optional().catch(undefined),
  menu_price: z.coerce.number().positive().max(500).nullable().optional().catch(null),
  menu_serves: z.coerce.number().int().min(1).max(12).catch(1).optional(),
  contains: z
    .array(z.string())
    .transform((c) => [...new Set(c.filter((x) => (CONTAINS as readonly string[]).includes(x)))])
    .optional()
    .catch([]),
  low_carb: z.boolean().optional().catch(false),
  plate_cost: z.coerce.number().positive().max(200).nullable().optional().catch(null),
  out_price: z.coerce.number().positive().max(500).nullable().optional().catch(null),
  ingredients: z.array(IngredientSchema).max(30).optional(),
  steps: z.array(z.string().trim().min(1).max(400)).max(14).optional(),
});
export type Recognized = z.infer<typeof RecognizedSchema>;

/** A recipe as stored and shown in the app. */
export type Recipe = {
  id: string;
  slug: string;
  dish: string;
  restaurant: string | null;
  cuisine: string | null;
  meals: Meal[];
  /** Non-copycats: typical takeout price per plate for a comparable dish (Claude's estimate). */
  out_price: number | null;
  /** How many people one restaurant order at menu_price feeds (1 for an entrée; 2–4 for shareable appetizers). */
  menu_serves: number;
  /** What it contains (meat, dairy, gluten, ...) and the diet tags that follow from it. Empty = not checked yet. */
  contains: string[];
  diet_tags: Diet[];
  /** Set when this is a "Make it my way" version of another recipe. */
  variant_of: string | null;
  variant_kind: string | null;
  /** "snap" = from a photo; "leftovers" = a Plateful original written to use up leftovers. */
  source: "snap" | "leftovers";
  style: string | null;
  servings: number;
  minutes: number | null;
  difficulty: string | null;
  confidence: number | null;
  why: string | null;
  menu_price: number | null;
  plate_cost: number | null;
  ingredients: Ingredient[];
  steps: string[];
  image_url: string | null;
  created_at: string;
};

/**
 * JSON Schema for Claude's structured output (output_config.format), so the reply is always valid JSON.
 * Structured outputs require every property listed in `required`, `additionalProperties: false`,
 * and no numeric or length limits; ranges are described in text and enforced by RecognizedSchema.
 */
const nullableString = (description: string) => ({ type: ["string", "null"], description });

export const recipeOutputSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "is_food", "reason", "dish", "cuisine", "meals", "restaurant", "servings", "minutes", "difficulty",
    "confidence", "why", "menu_price", "menu_serves", "plate_cost", "out_price", "contains", "low_carb", "ingredients", "steps",
  ],
  properties: {
    is_food: { type: "boolean", description: "False if the image does not show a prepared dish." },
    reason: nullableString("When is_food is false, a short reason. Otherwise null."),
    dish: { type: "string", description: "Menu-style dish name. Empty string when is_food is false." },
    cuisine: {
      type: "string",
      description: "One broad cuisine a person would filter by, e.g. Mexican, Italian, American, Chinese, Japanese, Thai, Indian, Mediterranean. Empty string when is_food is false.",
    },
    meals: {
      type: "array",
      description:
        "When people usually eat this: one or two of breakfast, lunch, dinner, dessert, snack, drink. Use snack (not dinner) for sides, appetizers and breads like fries, garlic bread or wings; use dinner only for a main course. Empty when is_food is false.",
      items: { type: "string", enum: ["breakfast", "lunch", "dinner", "dessert", "snack", "drink"] },
    },
    restaurant: nullableString(
      "The restaurant the user named, or one clearly shown by branding or packaging in the photo. Null otherwise. Never guess.",
    ),
    servings: { type: "integer", description: "Usually 2. Between 1 and 12." },
    minutes: { type: "integer", description: "Total active + passive time in minutes." },
    difficulty: { type: "string", enum: ["Easy", "Medium", "Hard"] },
    confidence: { type: "number", description: "0 to 1: how sure you are of the dish identity." },
    why: { type: "string", description: "One sentence naming the visual cues used." },
    menu_price: {
      type: ["number", "null"],
      description: "Typical current US menu price in USD for this dish at that restaurant. Null if restaurant is null.",
    },
    contains: {
      type: "array",
      description:
        "Every one of these the recipe contains, including hidden sources: broth (meat/poultry), fish sauce (fish), soy sauce (soy and gluten), butter/cheese/cream (dairy), mayo (eggs), pasta/flour/bread/tortillas unless corn (gluten), pesto (tree_nuts). Empty when is_food is false.",
      items: { type: "string", enum: [...CONTAINS] },
    },
    low_carb: { type: "boolean", description: "True only if one serving is clearly low in carbs (roughly under 20 g net carbs)." },
    menu_serves: {
      type: "integer",
      description:
        "How many people one order at menu_price normally feeds: 1 for an entrée, sandwich, bowl or single dessert; 2-4 for shareable appetizers, platters, dips and family-size items.",
    },
    out_price: {
      type: ["number", "null"],
      description:
        "Typical current US takeout or casual-restaurant price for ONE person's portion of a dish like this one (same kind of dish, similar portion), in USD. Always give it, even with no restaurant. Be honest, not inflated.",
    },
    plate_cost: {
      type: ["number", "null"],
      description: "Estimated grocery cost per serving in USD, counting only the portion of each ingredient used.",
    },
    ingredients: {
      type: "array",
      description: "4 to 16 ingredients. Empty when is_food is false.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "qty", "unit", "aisle", "price", "pack_qty"],
        properties: {
          name: { type: "string" },
          qty: { type: "number", description: "Quantity for the stated servings. 0 if 'to taste'." },
          unit: { type: "string", description: "Empty string for countable items." },
          aisle: { type: "string", enum: AISLES.filter((a) => a !== "Other") },
          price: {
            type: "number",
            description: "Typical US grocery price in USD of the package you'd buy. 0 for salt, pepper, oil and water.",
          },
          pack_qty: {
            type: "number",
            description:
              "How much of it comes in that package, in the SAME unit as qty (e.g. qty 2 tbsp of a 7 oz can of chipotles = about 14 tbsp). 0 when price is 0 or you'd buy exactly the amount used.",
          },
        },
      },
    },
    steps: { type: "array", description: "3 to 9 steps. Empty when is_food is false.", items: { type: "string" } },
  },
} as const;

/**
 * The restaurant price for ONE plate. A $12.49 order of nachos that feeds 3 is $4.16 a plate, which is
 * what a home plate should be compared with.
 */
export function menuPlate(r: Pick<Recipe, "menu_price"> & { menu_serves?: number | null }): number | null {
  if (!r.menu_price) return null;
  return Math.round((r.menu_price / Math.max(1, r.menu_serves ?? 1)) * 100) / 100;
}

/** Savings per plate vs. the restaurant. */
export function savings(r: Pick<Recipe, "menu_price" | "plate_cost"> & { menu_serves?: number | null }) {
  const out = menuPlate(r);
  if (!out || !r.plate_cost || r.plate_cost >= out) return null;
  const saved = out - r.plate_cost;
  return { saved, pct: Math.round((saved / out) * 100) };
}

/** "$12.49 (serves 3)" or "$11.25". */
export function menuLabel(r: Pick<Recipe, "menu_price"> & { menu_serves?: number | null }, money: (n: number) => string) {
  if (!r.menu_price) return "";
  return (r.menu_serves ?? 1) > 1 ? `${money(r.menu_price)} (serves ${r.menu_serves})` : money(r.menu_price);
}

export function slugify(dish: string, restaurant?: string | null) {
  const base = [restaurant, dish]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/, "");
  return base || "dish";
}

/** Label above a recipe's name: "Chipotle copycat" or "Grandma-style · Plateful original". */
export function recipeLabel(r: Pick<Recipe, "restaurant" | "style" | "source">): string | null {
  if (r.restaurant) return `${r.restaurant} copycat`;
  if (r.style || r.source === "leftovers") return `${r.style ? `${r.style} · ` : ""}Plateful original`;
  return null;
}

export const LEFTOVER_STYLES = {
  weeknight: { label: "Weeknight easy", style: "Weeknight", brief: "a fast weeknight dinner: 30 minutes or less, one pan or pot where possible, minimal prep" },
  grandma: { label: "Grandma's kitchen", style: "Grandma-style", brief: "cozy, from-scratch home cooking in an old-fashioned family style, the kind of dish passed down on a recipe card" },
  chef: { label: "Chef-style", style: "Chef-style", brief: "a restaurant-quality plate with one technique or finishing touch that makes it special, still doable for a home cook" },
  surprise: { label: "Surprise me", style: "Plateful kitchen", brief: "any cuisine or style that makes the best use of these leftovers" },
} as const;
export type LeftoverStyle = keyof typeof LEFTOVER_STYLES;
