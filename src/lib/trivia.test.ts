import { test } from "node:test";
import assert from "node:assert/strict";
import { TriviaDraftSchema, addDays, shuffleChoices, triviaDay, triviaPoints, triviaShareText, triviaStreak } from "./trivia.ts";

test("trivia day is the UTC date", () => {
  assert.equal(triviaDay(new Date("2026-11-02T23:30:00-05:00")), "2026-11-03");
  assert.equal(addDays("2026-02-28", 1), "2026-03-01");
  assert.equal(addDays("2026-01-01", -1), "2025-12-31");
});

test("streak counts back from today, or from yesterday before today's play", () => {
  const today = "2026-11-05";
  assert.equal(triviaStreak([], today), 0);
  assert.equal(triviaStreak(["2026-11-05", "2026-11-04", "2026-11-03"], today), 3);
  assert.equal(triviaStreak(["2026-11-04", "2026-11-03"], today), 2); // not played yet today: still alive
  assert.equal(triviaStreak(["2026-11-05", "2026-11-03"], today), 1); // missed a day
  assert.equal(triviaStreak(["2026-11-02"], today), 0);
});

test("points: one per right answer, bonus every 7th day in a row", () => {
  assert.deepEqual(triviaPoints(2, 3), { answers: 2, bonus: 0, total: 2 });
  assert.deepEqual(triviaPoints(3, 7), { answers: 3, bonus: 5, total: 8 });
  assert.deepEqual(triviaPoints(0, 14), { answers: 0, bonus: 5, total: 5 });
  assert.equal(triviaPoints(9, 1).answers, 3); // capped at 3 questions
  // A perfect 30-day month stays around 100 points: well under a few cook-off entries and wins.
  let month = 0;
  for (let d = 1; d <= 30; d++) month += triviaPoints(3, d).total;
  assert.equal(month, 110);
});

test("share text hides the answers", () => {
  const text = triviaShareText("2026-11-02", [true, false, true], "https://example.com/trivia");
  assert.equal(text, "Yumjack trivia · Nov 2\n🟩🟥🟩 2/3\nhttps://example.com/trivia");
});

test("shuffling keeps the right answer attached", () => {
  const choices = ["a", "b", "c", "d"];
  for (const seed of [0, 0.3, 0.6, 0.99]) {
    const s = shuffleChoices(choices, 2, () => seed);
    assert.equal(s.choices[s.answer], "c");
    assert.deepEqual([...s.choices].sort(), choices);
  }
});

test("draft check rejects bad questions", () => {
  const good = { question: "Which oil has the highest smoke point?", choices: ["Avocado", "Butter", "Olive", "Flaxseed"], answer_index: 0, why: "Refined avocado oil handles searing heat best." };
  assert.ok(TriviaDraftSchema.safeParse(good).success);
  assert.ok(!TriviaDraftSchema.safeParse({ ...good, choices: ["A", "B", "C"] }).success);
  assert.ok(!TriviaDraftSchema.safeParse({ ...good, choices: ["A", "a", "C", "D"] }).success);
  assert.ok(!TriviaDraftSchema.safeParse({ ...good, answer_index: 4 }).success);
});
