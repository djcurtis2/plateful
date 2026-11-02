import { test } from "node:test";
import assert from "node:assert/strict";
import { formatQty, packagesNeeded, pantryKey } from "./format.ts";
import { slugify, savings } from "./recipe.ts";

test("formatQty renders fractions", () => {
  assert.equal(formatQty(1.5, "cup"), "1½ cup");
  assert.equal(formatQty(0.25, "tsp"), "¼ tsp");
  assert.equal(formatQty(0.333, "cup"), "⅓ cup");
  assert.equal(formatQty(2, ""), "2");
  assert.equal(formatQty(2.97, "lb"), "3 lb");
  assert.equal(formatQty(2.4, "oz"), "2.4 oz");
  assert.equal(formatQty(0, ""), "to taste");
});

test("packagesNeeded never below one", () => {
  assert.equal(packagesNeeded(0.5), 1);
  assert.equal(packagesNeeded(1), 1);
  assert.equal(packagesNeeded(2), 2);
  assert.equal(packagesNeeded(4), 3);
});

test("pantryKey matches common variants", () => {
  assert.equal(pantryKey("Garlic cloves"), pantryKey("garlic"));
  assert.equal(pantryKey("Limes"), pantryKey("lime"));
  assert.equal(pantryKey("Cherry tomatoes"), "cherry tomato");
  assert.equal(pantryKey("Hummus"), "hummus");
  assert.equal(pantryKey("Parmesan, grated"), "parmesan");
  assert.equal(pantryKey("Chicken thighs, boneless"), pantryKey("chicken thigh"));
});

test("slugify and savings", () => {
  assert.equal(slugify("Chicken Burrito Bowl", "Chipotle"), "chipotle-chicken-burrito-bowl");
  assert.equal(slugify("Crème brûlée"), "creme-brulee");
  assert.deepEqual(savings({ menu_price: 10, plate_cost: 4 }), { saved: 6, pct: 60 });
  assert.equal(savings({ menu_price: 4, plate_cost: 6 }), null);
  assert.equal(savings({ menu_price: null, plate_cost: 6 }), null);
  assert.deepEqual(savings({ menu_price: 12, menu_serves: 3, plate_cost: 2 }), { saved: 2, pct: 50 });
});

test("RecognizedSchema accepts structured-output replies, including not-food", async () => {
  const { RecognizedSchema } = await import("./recipe.ts");
  const food = RecognizedSchema.parse({
    is_food: true, reason: null, dish: "Chicken burrito bowl", cuisine: "Mexican", restaurant: null,
    servings: 2, minutes: 35, difficulty: "Easy", confidence: 0.9, why: "Rice, beans, chicken.",
    menu_price: null, plate_cost: 3.4,
    ingredients: [{ name: "Rice", qty: 1, unit: "cup", aisle: "Pantry", price: 2.99 }],
    steps: ["Cook rice.", "Build bowls.", "Eat."],
  });
  assert.equal(food.dish, "Chicken burrito bowl");
  assert.equal(food.restaurant, null);
  const notFood = RecognizedSchema.parse({
    is_food: false, reason: "That's a cat.", dish: "", cuisine: "", restaurant: null, servings: 1, minutes: 1,
    difficulty: "Easy", confidence: 0, why: "", menu_price: null, plate_cost: null, ingredients: [], steps: [],
  });
  assert.equal(notFood.is_food, false);
  assert.equal(notFood.reason, "That's a cat.");
});
