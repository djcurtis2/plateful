import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bingoTally,
  BINGO_FREE,
  bingoCard,
  bingoLines,
  bingoMarks,
  bingoShareText,
  dishHints,
  dishPoints,
  dishShareText,
  dishView,
  hlPoints,
  hlRight,
  sameDish,
  seededShuffle,
  weekStart,
  type BingoActivity,
} from "./games.ts";

test("seeded shuffles are stable per seed and differ between days", () => {
  const items = Array.from({ length: 20 }, (_, i) => i);
  assert.deepEqual(seededShuffle(items, "a"), seededShuffle(items, "a"));
  assert.notDeepEqual(seededShuffle(items, "2026-11-02"), seededShuffle(items, "2026-11-03"));
  assert.deepEqual([...seededShuffle(items, "x")].sort((a, b) => a - b), items);
});

test("guess the dish: view, hints, scoring, share", () => {
  assert.ok(dishView(0, false).blur > dishView(3, false).blur);
  assert.deepEqual(dishView(2, true), { scale: 1, blur: 0 });
  const info = { cuisine: "Mexican", meal: "Dinner", label: "Chipotle copycat" };
  assert.equal(dishHints(1, info).length, 0);
  assert.deepEqual(dishHints(4, info).map((h) => h.name), ["Cuisine", "Meal", "Label"]);
  assert.ok(sameDish("Chicken  burrito bowl!", "chicken burrito bowl"));
  assert.equal(dishPoints(2, true), 3);
  assert.equal(dishPoints(4, true), 2);
  assert.equal(dishPoints(6, true), 1);
  assert.equal(dishPoints(6, false), 0);
  assert.equal(dishShareText("2026-11-02", [false, false, true], "u").split("\n")[1], "🟥🟥🟩 3/6");
  assert.match(dishShareText("2026-11-02", Array(6).fill(false), "u"), /X\/6/);
});

test("higher or lower: ties count, points cap", () => {
  assert.equal(hlRight(5, 7, "higher"), true);
  assert.equal(hlRight(5, 3, "higher"), false);
  assert.equal(hlRight(5, 5, "lower"), true);
  assert.equal(hlPoints(4), 0);
  assert.equal(hlPoints(10), 2);
  assert.equal(hlPoints(99), 3);
});

test("bingo: weeks start Monday, free centre, lines", () => {
  assert.equal(weekStart("2026-11-02"), "2026-11-02"); // a Monday
  assert.equal(weekStart("2026-11-08"), "2026-11-02"); // Sunday
  assert.equal(weekStart("2026-11-09"), "2026-11-09");
  const card = bingoCard("2026-11-02");
  assert.equal(card.length, 9);
  assert.equal(card[4], BINGO_FREE);
  assert.equal(new Set(card.filter((c) => c !== BINGO_FREE).map((c) => (c as { id: string }).id)).size, 8);
  assert.deepEqual(bingoCard("2026-11-02"), card);
  const none: BingoActivity = { cooked: 0, copycats: 0, cheapest: null, vegetarian: 0, cuisines: 0, versions: 0, originals: 0, entries: 0, votes: 0, triviaDays: 0, snaps: 0, saved: 0, plans: 0, shares: 0 };
  const marks = bingoMarks(card, none);
  assert.deepEqual(marks.map((m, i) => (m ? i : -1)).filter((i) => i >= 0), [4]);
  assert.deepEqual(bingoLines([true, true, true, false, true, false, false, false, false]), [0]);
  assert.equal(bingoLines(Array(9).fill(true)).length, 8);
  assert.match(bingoShareText("2026-11-02", Array(9).fill(true), "u"), /Full card/);
});

test("bingoTally counts lifetime lines and full cards from ledger refs", () => {
  assert.deepEqual(bingoTally([]), { lines: 0, full: 0 });
  assert.deepEqual(
    bingoTally(["bingo:2026-11-02:line0", "bingo:2026-11-02:line3", "bingo:2026-11-02:full", "bingo:2026-11-09:line1", "dish:2026-11-02", "trivia:x:line1"]),
    { lines: 3, full: 1 },
  );
});

test("the share square joins every card from SHARE_SQUARE_FROM and leaves earlier cards alone", () => {
  const ids = (week: string) => bingoCard(week).map((s) => (s === BINGO_FREE ? "free" : s.id));
  assert.ok(!ids("2026-11-09").includes("share"));
  for (const week of ["2026-11-16", "2026-11-23", "2026-11-30"]) {
    const card = ids(week);
    assert.ok(card.includes("share"), week);
    assert.equal(card.length, 9);
    assert.equal(card[4], "free");
    assert.equal(new Set(card).size, 9);
  }
});
