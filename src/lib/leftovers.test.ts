import { test } from "node:test";
import assert from "node:assert/strict";
import { leftoversFor, shareLabel, useItUp } from "./leftovers.ts";
import type { Ingredient } from "./recipe.ts";

const g = (name: string, o: Partial<Ingredient> = {}): Ingredient => ({ name, qty: 1, unit: "", aisle: "Pantry", price: 3, ...o });

test("leftovers from package sizes, skipping staples, meat and pantry items", () => {
  const ing = [
    g("Chipotles in adobo", { qty: 2, unit: "tbsp", pack_qty: 14, price: 2.5, aisle: "International" }),
    g("Cilantro", { qty: 0.25, unit: "cup", pack_qty: 1, price: 1.2, aisle: "Produce" }),
    g("Chicken thighs", { qty: 1, unit: "lb", pack_qty: 1, price: 6, aisle: "Meat" }),
    g("Salt", { price: 0 }),
    g("Garlic cloves", { qty: 2, pack_qty: 10, price: 0.8, aisle: "Produce" }),
  ];
  const l = leftoversFor(ing, ["garlic"]);
  assert.deepEqual(l.map((x) => x.key), ["chipotles in adobo", "cilantro"]);
  assert.equal(l[0].measured, true);
  assert.equal(shareLabel(l[0]), "most");
});

test("older recipes without package sizes get a best guess", () => {
  const l = leftoversFor([g("Sour cream", { aisle: "Dairy", price: 2.5 }), g("Ground beef", { aisle: "Meat", price: 6 }), g("Lime", { aisle: "Produce", price: 0.5 })]);
  assert.deepEqual(l.map((x) => x.key), ["sour cream"]);
  assert.equal(l[0].measured, false);
});

test("suggestions rank by leftover value used", () => {
  const left = leftoversFor([
    g("Chipotle peppers in adobo", { qty: 2, pack_qty: 14, price: 2.5 }),
    g("Sour cream", { qty: 0.25, pack_qty: 2, price: 2.5, aisle: "Dairy" }),
  ]);
  const recipes = [
    { id: "self", ingredients: [g("Chipotle peppers in adobo")] },
    { id: "a", ingredients: [g("Sour cream"), g("Rice")] },
    { id: "b", ingredients: [g("Chipotle peppers in adobo sauce"), g("Sour cream")] },
    { id: "c", ingredients: [g("Pasta")] },
  ];
  const s = useItUp(left, recipes, "self");
  assert.deepEqual(s.map((x) => x.recipe.id), ["b", "a"]);
  assert.equal(s[0].uses.length, 2);
});
