import { test } from "node:test";
import assert from "node:assert/strict";
import { ingredientLine, isoMinutes, jsonLdScript, recipeJsonLd, recipeTitle } from "./seo.ts";

const soup = {
  slug: "chilis-chicken-enchilada-soup",
  dish: "Chicken enchilada soup",
  restaurant: "Chili's",
  cuisine: "Mexican",
  meals: ["lunch", "dinner"] as ("lunch" | "dinner")[],
  servings: 4,
  minutes: 40,
  why: null,
  ingredients: [
    { name: "Chicken thighs", qty: 1.5, unit: "lb", aisle: "Meat" as const, price: 6.5 },
    { name: "Salt", qty: 0, unit: "", aisle: "Pantry" as const, price: 0 },
  ],
  steps: ["Brown the chicken.", "Simmer with broth."],
  image_url: "https://example.com/soup.jpg",
  created_at: "2026-11-01T12:00:00Z",
  diet_tags: ["gluten_free", "vegetarian"] as ("gluten_free" | "vegetarian")[],
};

test("titles name the restaurant only for copycats", () => {
  assert.equal(recipeTitle(soup), "Chili's Chicken enchilada soup copycat");
  assert.equal(recipeTitle({ dish: "Pesto chicken", restaurant: null }), "Pesto chicken recipe");
});

test("ingredient lines and times read the way Google expects", () => {
  assert.equal(ingredientLine({ name: "Rice", qty: 1.5, unit: "cup" }), "1½ cup Rice");
  assert.equal(ingredientLine({ name: "Salt", qty: 0, unit: "" }), "Salt, to taste");
  assert.equal(isoMinutes(40), "PT40M");
  assert.equal(isoMinutes(90), "PT1H30M");
  assert.equal(isoMinutes(120), "PT2H");
});

test("recipe tags carry the recipe, and allergy-style diets stay off", () => {
  const ld = recipeJsonLd(soup, "https://yumjack.app", "A cheaper bowl at home.");
  assert.equal(ld["@type"], "Recipe");
  assert.equal(ld.url, "https://yumjack.app/r/chilis-chicken-enchilada-soup");
  assert.deepEqual(ld.image, ["https://example.com/soup.jpg"]);
  assert.equal(ld.totalTime, "PT40M");
  assert.equal(ld.recipeYield, "4 servings");
  assert.deepEqual(ld.recipeIngredient, ["1½ lb Chicken thighs", "Salt, to taste"]);
  assert.equal(ld.recipeInstructions[1].text, "Simmer with broth.");
  assert.deepEqual(ld.suitableForDiet, ["https://schema.org/VegetarianDiet"]);
  const noPhoto = recipeJsonLd({ ...soup, image_url: null }, "https://yumjack.app", "x");
  assert.equal("image" in noPhoto, false);
});

test("recipe text can't break out of the script tag", () => {
  assert.equal(jsonLdScript({ a: "</script><b>" }).includes("</script>"), false);
});
