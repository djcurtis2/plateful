import { test } from "node:test";
import assert from "node:assert/strict";
import { dishArt } from "./dish-art.ts";

test("soups and stews get a bowl, the rest a plate", () => {
  assert.equal(dishArt("Chicken enchilada soup").shape, "bowl");
  assert.equal(dishArt("Hearty beef chili").shape, "bowl");
  assert.equal(dishArt("Sheet Pan Lemon Herb Salmon with Roasted Baby Potatoes").shape, "plate");
});

test("the dish name decides the main color before the ingredients do", () => {
  const salmon = dishArt("Lemon Herb Salmon with Roasted Baby Potatoes", ["salmon fillets", "chicken broth"]);
  assert.equal(salmon.main, "#f08a5d");
  assert.equal(salmon.side, "#e9c46a"); // potatoes
  const chicken = dishArt("Honey Garlic Chicken Thighs with Roasted Carrots", ["chicken thighs", "carrots"]);
  assert.equal(chicken.main, "#d99a3d");
  assert.equal(chicken.side, "#ea8a2f");
});

test("falls back to ingredients, then to saffron", () => {
  assert.equal(dishArt("Weeknight special", ["ground beef", "onion"]).main, "#7a3e22");
  assert.equal(dishArt("Mystery").main, "#f2b630");
});

test("same recipe always draws the same way; the side never matches the main", () => {
  assert.deepEqual(dishArt("Pesto Chicken", [], "abc"), dishArt("Pesto Chicken", [], "abc"));
  const greens = dishArt("Garden salad", ["lettuce", "spinach"]);
  assert.notEqual(greens.side, greens.main);
});
