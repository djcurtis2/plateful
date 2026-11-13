import { test } from "node:test";
import assert from "node:assert/strict";
import { KROGER_MAX_ITEMS, cleanCartItems, krogerTerm, parseResult, safeBack, withResult } from "./kroger.ts";

test("krogerTerm keeps the product, drops notes", () => {
  assert.equal(krogerTerm("butter, softened"), "butter");
  assert.equal(krogerTerm("chicken thighs (boneless, skinless)"), "chicken thighs");
  assert.equal(krogerTerm("soy sauce & rice vinegar"), "soy sauce rice vinegar");
  assert.equal(krogerTerm("one two three four five six seven eight nine ten"), "one two three four five six seven eight");
  assert.equal(krogerTerm("ox"), null);
  assert.equal(krogerTerm("  (to serve)"), null);
});

test("cleanCartItems trims, dedupes and caps", () => {
  assert.deepEqual(cleanCartItems(["Milk", " milk ", "", 4, "eggs"]), ["Milk", "eggs"]);
  assert.deepEqual(cleanCartItems("milk"), []);
  const many = Array.from({ length: 60 }, (_, i) => `item ${i}`);
  assert.equal(cleanCartItems(many).length, KROGER_MAX_ITEMS);
});

test("safeBack stays on this site", () => {
  assert.equal(safeBack("/r/tacos"), "/r/tacos");
  assert.equal(safeBack("https://evil.example"), "/");
  assert.equal(safeBack("//evil.example"), "/");
  assert.equal(safeBack("/\\evil.example"), "/");
  assert.equal(safeBack(null), "/");
});

test("withResult and parseResult round trip", () => {
  assert.equal(withResult("/plan?week=2#list", "5-6"), "/plan?week=2&kroger=5-6#list");
  assert.equal(withResult("/r/tacos?kroger=1-1", "error"), "/r/tacos?kroger=error");
  assert.deepEqual(parseResult("5-6"), { added: 5, of: 6 });
  assert.equal(parseResult("cancel"), "cancel");
  assert.equal(parseResult("junk"), null);
  assert.equal(parseResult(null), null);
});
