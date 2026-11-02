// Dietary preferences and recipe versions. Pure; covered by diet.test.ts.
// Claude lists what a recipe CONTAINS; diet tags are worked out here with fixed rules, so they stay consistent.
// These are preferences, not allergy guarantees: the UI always says to check labels.

export const CONTAINS = ["meat", "poultry", "pork", "fish", "shellfish", "dairy", "eggs", "gluten", "peanuts", "tree_nuts", "soy", "sesame"] as const;
export type Contains = (typeof CONTAINS)[number];

export const DIETS = {
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  pescatarian: "Pescatarian",
  gluten_free: "Gluten-free",
  dairy_free: "Dairy-free",
  nut_free: "Nut-free",
  low_carb: "Low-carb",
} as const;
export type Diet = keyof typeof DIETS;
export const DIET_IDS = Object.keys(DIETS) as Diet[];

/** Diet tags a recipe earns from what it contains (plus Claude's low-carb call). */
export function dietTagsFrom(contains: readonly string[], lowCarb: boolean): Diet[] {
  const has = (...c: Contains[]) => c.some((x) => contains.includes(x));
  const tags: Diet[] = [];
  const noLandMeat = !has("meat", "poultry", "pork");
  const vegetarian = noLandMeat && !has("fish", "shellfish");
  if (vegetarian) tags.push("vegetarian");
  if (vegetarian && !has("dairy", "eggs")) tags.push("vegan");
  if (noLandMeat) tags.push("pescatarian");
  if (!has("gluten")) tags.push("gluten_free");
  if (!has("dairy")) tags.push("dairy_free");
  if (!has("peanuts", "tree_nuts")) tags.push("nut_free");
  if (lowCarb) tags.push("low_carb");
  return tags;
}

type Tagged = { diet_tags: readonly string[]; contains: readonly string[] };

/** True when a recipe has been checked at all (older recipes may not be tagged yet). */
export function isTagged(r: Tagged) {
  return r.diet_tags.length > 0 || r.contains.length > 0;
}

/** Which of your diets this recipe doesn't meet. Untagged recipes fail every diet (unknown isn't safe). */
export function dietMisses(r: Tagged, diets: readonly string[]): Diet[] {
  return diets.filter((d) => !r.diet_tags.includes(d)) as Diet[];
}

export function fitsDiets(r: Tagged, diets: readonly string[]) {
  return dietMisses(r, diets).length === 0;
}

/** "Make it my way" options. Diet versions must meet that diet; the rest change the style. */
export const VERSIONS = {
  vegetarian: { label: "Vegetarian", diet: "vegetarian", brief: "fully vegetarian: no meat, poultry, fish or shellfish, and no meat-based broth, gelatin or fish sauce" },
  vegan: { label: "Vegan", diet: "vegan", brief: "fully vegan: no animal products at all, including dairy, eggs, honey, butter, gelatin, fish sauce and meat broths" },
  gluten_free: { label: "Gluten-free", diet: "gluten_free", brief: "gluten-free: no wheat, barley, rye or regular soy sauce (use tamari), regular pasta, flour, breadcrumbs or beer; say 'certified gluten-free' for oats" },
  dairy_free: { label: "Dairy-free", diet: "dairy_free", brief: "dairy-free: no milk, butter, cream, cheese, yogurt or whey; use plant-based swaps" },
  lighter: { label: "Lighter", diet: null, brief: "noticeably lighter: fewer calories and less fat, more vegetables, still satisfying" },
  high_protein: { label: "High-protein", diet: null, brief: "high-protein: more protein per serving through leaner or extra protein sources" },
  cheaper: { label: "Cheaper", diet: null, brief: "cheaper per plate: budget swaps and pantry staples, without losing what makes the dish good" },
  kid_friendly: { label: "Kid-friendly", diet: null, brief: "kid-friendly: milder spice, familiar textures, simple to eat, still close to the original" },
  spicier: { label: "Spicier", diet: null, brief: "spicier: more heat and punch, while keeping the original's flavor" },
  air_fryer: { label: "Air fryer", diet: null, brief: "made in an air fryer instead of deep-frying or the oven, with times and temperatures for a basket air fryer" },
} as const;
export type VersionKind = keyof typeof VERSIONS;
export const VERSION_IDS = Object.keys(VERSIONS) as VersionKind[];

export const ALLERGY_NOTE = "Diet tags are a guide, not an allergy guarantee. Always check ingredient labels, especially for allergies.";
