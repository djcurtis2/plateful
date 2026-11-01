import { z } from "zod";

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
});
export type Ingredient = z.infer<typeof IngredientSchema>;

/** What the recognition model returns. Lenient on optional fields so one odd value doesn't fail a scan. */
export const RecognizedSchema = z.object({
  is_food: z.boolean(),
  reason: z.string().max(300).nullable().optional().catch(null),
  dish: z.string().trim().transform((d) => d.slice(0, 90)).optional().catch(undefined),
  cuisine: z.string().trim().max(60).optional().catch(undefined),
  restaurant: z.string().trim().max(80).nullable().optional().catch(null),
  servings: z.coerce.number().int().min(1).max(24).catch(2).optional(),
  minutes: z.coerce.number().int().min(1).max(1440).catch(30).optional(),
  difficulty: z.enum(["Easy", "Medium", "Hard"]).catch("Easy").optional(),
  confidence: z.coerce.number().min(0).max(1).catch(0.7).optional(),
  why: z.string().max(300).optional().catch(undefined),
  menu_price: z.coerce.number().positive().max(500).nullable().optional().catch(null),
  plate_cost: z.coerce.number().positive().max(200).nullable().optional().catch(null),
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
    "is_food", "reason", "dish", "cuisine", "restaurant", "servings", "minutes", "difficulty",
    "confidence", "why", "menu_price", "plate_cost", "ingredients", "steps",
  ],
  properties: {
    is_food: { type: "boolean", description: "False if the image does not show a prepared dish." },
    reason: nullableString("When is_food is false, a short reason. Otherwise null."),
    dish: { type: "string", description: "Menu-style dish name. Empty string when is_food is false." },
    cuisine: { type: "string" },
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
        required: ["name", "qty", "unit", "aisle", "price"],
        properties: {
          name: { type: "string" },
          qty: { type: "number", description: "Quantity for the stated servings. 0 if 'to taste'." },
          unit: { type: "string", description: "Empty string for countable items." },
          aisle: { type: "string", enum: AISLES.filter((a) => a !== "Other") },
          price: {
            type: "number",
            description: "Typical US grocery price in USD of the package you'd buy. 0 for salt, pepper, oil and water.",
          },
        },
      },
    },
    steps: { type: "array", description: "3 to 9 steps. Empty when is_food is false.", items: { type: "string" } },
  },
} as const;

export function savings(r: Pick<Recipe, "menu_price" | "plate_cost">) {
  if (!r.menu_price || !r.plate_cost || r.plate_cost >= r.menu_price) return null;
  const saved = r.menu_price - r.plate_cost;
  return { saved, pct: Math.round((saved / r.menu_price) * 100) };
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
