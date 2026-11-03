import { test } from "node:test";
import assert from "node:assert/strict";
import { computeStreak, levelFor, publicName, rankEntries, standing, streakBonus, timeLeft, validPublicName } from "./game.ts";

test("levels and progress", () => {
  assert.equal(levelFor(0).name, "Line cook");
  assert.equal(levelFor(99).toNext, 1);
  assert.equal(levelFor(100).name, "Prep cook");
  assert.equal(levelFor(1500).name, "Executive chef");
  assert.equal(levelFor(5000).next, null);
  assert.equal(levelFor(200).progress, 0.5);
});

test("streaks: live week doesn't break, missed past week does", () => {
  const now = new Date("2026-11-04T12:00:00Z");
  const ch = [
    { id: "w4", ends_at: "2026-11-07T00:00:00Z" }, // live
    { id: "w3", ends_at: "2026-10-31T00:00:00Z" },
    { id: "w2", ends_at: "2026-10-24T00:00:00Z" },
    { id: "w1", ends_at: "2026-10-17T00:00:00Z" },
  ];
  assert.equal(computeStreak(ch, new Set(["w3", "w2"]), now), 2); // not yet entered live week
  assert.equal(computeStreak(ch, new Set(["w4", "w3", "w2"]), now), 3);
  assert.equal(computeStreak(ch, new Set(["w4", "w2", "w1"]), now), 1); // missed w3
  assert.equal(computeStreak(ch, new Set([]), now), 0);
  assert.equal(streakBonus(1), 0);
  assert.equal(streakBonus(3), 30);
});

test("ranking and standing", () => {
  const e = [
    { id: "a", votes: 3, created_at: "2026-11-02" },
    { id: "b", votes: 5, created_at: "2026-11-03" },
    { id: "c", votes: 3, created_at: "2026-11-01" },
  ];
  assert.deepEqual(rankEntries(e).map((x) => x.id), ["b", "c", "a"]);
  assert.deepEqual(standing(e, "a"), { rank: 3, of: 3, votes: 3, behindNext: 1 });
  assert.deepEqual(standing(e, "c"), { rank: 2, of: 3, votes: 3, behindNext: 3 });
  assert.equal(standing(e, "b")?.behindNext, 0);
  assert.equal(standing(e, "zzz"), null);
});

test("names and time", () => {
  assert.equal(publicName(null), "A Dupe Kitchen cook");
  assert.equal(publicName("  Dan "), "Dan");
  assert.equal(validPublicName("D"), "Use 2 to 30 characters.");
  assert.equal(validPublicName("Chef Dan"), null);
  assert.equal(validPublicName("José_O'Neil-2"), null);
  assert.ok(validPublicName("<script>"));
  const now = new Date("2026-11-01T00:00:00Z");
  assert.equal(timeLeft("2026-11-04T00:00:00Z", now), "3 days left");
  assert.equal(timeLeft("2026-11-01T05:00:00Z", now), "5 hours left");
  assert.equal(timeLeft("2026-10-31T00:00:00Z", now), "Ended");
});

test("receipt verdicts", async () => {
  const { receiptVerdict } = await import("./game.ts");
  const start = new Date("2026-11-01T00:00:00Z");
  const now = new Date("2026-11-04T00:00:00Z");
  const base = { is_receipt: true, purchase_date: "2026-11-02", matched: [{ ingredient: "Rice" }, { ingredient: "Chicken" }, { ingredient: "Limes" }], cost_per_plate: 3.214 };
  assert.deepEqual(receiptVerdict(base, 6, start, now), { ok: true, cost: 3.21 });
  assert.equal(receiptVerdict({ ...base, is_receipt: false }, 6, start, now).ok, false);
  assert.equal(receiptVerdict({ ...base, purchase_date: "2026-09-01" }, 6, start, now).ok, false); // too old
  assert.equal(receiptVerdict({ ...base, purchase_date: "2026-10-20" }, 6, start, now).ok, true); // within 2 weeks before start
  assert.equal(receiptVerdict({ ...base, matched: [{ ingredient: "Rice" }] }, 6, start, now).ok, false); // covers too little
  assert.equal(receiptVerdict({ ...base, cost_per_plate: null }, 6, start, now).ok, false);
});
