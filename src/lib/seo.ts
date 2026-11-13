// Recipe tags for search engines (schema.org JSON-LD), so Google can show recipe cards with a photo,
// time and ingredients. Pure, so it's testable. Covered by seo.test.ts.
import { formatQty } from "./format.ts";
import { MEAL_LABELS, type Recipe } from "./recipe.ts";

type Taggable = Pick<
  Recipe,
  "slug" | "dish" | "restaurant" | "cuisine" | "meals" | "servings" | "minutes" | "why" | "ingredients" | "steps" | "image_url" | "created_at" | "diet_tags"
>;

/** The page title for a recipe: copycats name the restaurant they're inspired by. */
export function recipeTitle(r: Pick<Recipe, "dish" | "restaurant">): string {
  return r.restaurant ? `${r.restaurant} ${r.dish} copycat` : `${r.dish} recipe`;
}

/** "1½ cup Rice", or "Salt, to taste" when there's no amount. */
export function ingredientLine(g: { name: string; qty: number; unit: string }): string {
  if (g.qty > 0) return `${formatQty(g.qty, g.unit)} ${g.name}`;
  return g.unit ? `${g.unit} ${g.name}` : `${g.name}, to taste`;
}

/** 90 → "PT1H30M" (ISO 8601 duration, which is what recipe tags use). */
export function isoMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `PT${h ? `${h}H` : ""}${m || !h ? `${m}M` : ""}`;
}

// Only lifestyle diets. Allergy-style claims (gluten-free and so on) stay off: our diet tags are a guide,
// not an allergy guarantee, and search results would read them as a promise.
const DIET_SCHEMA: Partial<Record<string, string>> = {
  vegetarian: "https://schema.org/VegetarianDiet",
  vegan: "https://schema.org/VeganDiet",
};

export function recipeJsonLd(r: Taggable, site: string, description: string) {
  const url = `${site}/r/${r.slug}`;
  const diets = r.diet_tags.map((d) => DIET_SCHEMA[d]).filter((d): d is string => !!d);
  return {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: recipeTitle(r),
    description,
    url,
    ...(r.image_url ? { image: [r.image_url] } : {}),
    author: { "@type": "Organization", name: "Yumjack", url: site },
    datePublished: r.created_at.slice(0, 10),
    recipeYield: `${r.servings} servings`,
    ...(r.minutes ? { totalTime: isoMinutes(r.minutes) } : {}),
    ...(r.cuisine ? { recipeCuisine: r.cuisine } : {}),
    ...(r.meals.length ? { recipeCategory: r.meals.map((m) => MEAL_LABELS[m]).join(", ") } : {}),
    ...(diets.length ? { suitableForDiet: diets } : {}),
    keywords: [r.restaurant ? "copycat recipe" : "homemade", r.restaurant, r.cuisine, "budget"].filter(Boolean).join(", "),
    recipeIngredient: r.ingredients.map(ingredientLine),
    recipeInstructions: r.steps.map((text, i) => ({ "@type": "HowToStep", position: i + 1, text })),
  };
}

/** JSON for a <script type="application/ld+json">: "<" escaped so recipe text can never close the tag. */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
