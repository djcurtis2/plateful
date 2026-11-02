import { test } from "node:test";
import assert from "node:assert/strict";
import { CLUBS, CLUB_BY_ID, MAX_CLUBS, cleanClubs } from "./clubs.ts";

test("cleanClubs keeps known ids, deduped, first MAX_CLUBS, in order", () => {
  assert.equal(MAX_CLUBS, 2);
  assert.deepEqual(cleanClubs(["dad-chef", "dad-chef", "nope", "budget-cook", "date-night"]), ["dad-chef", "budget-cook"]);
  assert.deepEqual(cleanClubs(["budget-cook", "dad-chef"]), ["budget-cook", "dad-chef"]);
});

test("cleanClubs rejects non-array input", () => {
  assert.deepEqual(cleanClubs("x"), []);
  assert.deepEqual(cleanClubs(null), []);
  assert.deepEqual(cleanClubs({ 0: "dad-chef" }), []);
});

test("cleanClubs ignores prototype keys from untrusted input", () => {
  assert.deepEqual(cleanClubs(["constructor", "__proto__"]), []);
  assert.deepEqual(cleanClubs(["toString", "hasOwnProperty"]), []);
});

test("club list has 8 to 12 unique kebab-case ids with names and blurbs", () => {
  assert.ok(CLUBS.length >= 8 && CLUBS.length <= 12, `count ${CLUBS.length}`);
  const ids = CLUBS.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const c of CLUBS) {
    assert.match(c.id, /^[a-z0-9]+(-[a-z0-9]+)*$/, c.id);
    assert.ok(c.name.trim().length > 0, c.id);
    assert.ok(c.blurb.trim().length > 0, c.id);
  }
});

test("CLUB_BY_ID finds every club and nothing inherited", () => {
  for (const c of CLUBS) assert.equal(CLUB_BY_ID[c.id], c);
  assert.equal(CLUB_BY_ID["constructor"], undefined);
  assert.equal(CLUB_BY_ID["__proto__"], undefined);
});

test("family clubs that mention kids are framed for parents", () => {
  for (const c of CLUBS) {
    const text = `${c.name} ${c.blurb}`;
    if (/\b(kid|kids|child|children|teen)\b/i.test(text)) {
      assert.match(text, /\b(parent|parents|my kids|family)\b/i, c.id);
    }
  }
});
