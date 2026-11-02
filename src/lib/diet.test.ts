import { test } from "node:test";
import assert from "node:assert/strict";
import { dietMisses, dietTagsFrom, fitsDiets } from "./diet.ts";

test("diet tags follow from what a recipe contains", () => {
  assert.deepEqual(dietTagsFrom(["poultry", "dairy", "gluten"], false), ["nut_free"]);
  assert.deepEqual(dietTagsFrom(["dairy", "eggs", "gluten"], false), ["vegetarian", "pescatarian", "nut_free"]);
  assert.deepEqual(dietTagsFrom([], true), ["vegetarian", "vegan", "pescatarian", "gluten_free", "dairy_free", "nut_free", "low_carb"]);
  assert.deepEqual(dietTagsFrom(["fish", "soy"], false), ["pescatarian", "gluten_free", "dairy_free", "nut_free"]);
  assert.ok(!dietTagsFrom(["tree_nuts"], false).includes("nut_free"));
});

test("matching your diets; untagged recipes never count as safe", () => {
  const veggie = { diet_tags: dietTagsFrom(["dairy"], false), contains: ["dairy"] };
  assert.equal(fitsDiets(veggie, ["vegetarian"]), true);
  assert.deepEqual(dietMisses(veggie, ["vegetarian", "dairy_free"]), ["dairy_free"]);
  assert.equal(fitsDiets({ diet_tags: [], contains: [] }, ["vegetarian"]), false);
  assert.equal(fitsDiets({ diet_tags: [], contains: [] }, []), true);
});
