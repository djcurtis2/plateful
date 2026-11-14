import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeTicks, upsertOfflineList, type OfflineList } from "./offline-lists.ts";

const list = (id: string, savedAt = "2026-11-14T10:00:00Z"): OfflineList => ({ id, title: id, kind: "recipe", lines: [], ticks: [], savedAt });

test("upsertOfflineList keeps the 5 newest, newest first", () => {
  let all: OfflineList[] = [];
  for (const id of ["a", "b", "c", "d", "e", "f"]) all = upsertOfflineList(all, list(id));
  assert.deepEqual(all.map((l) => l.id), ["f", "e", "d", "c", "b"]);
});

test("upsertOfflineList replaces the same id and moves it to the front", () => {
  const all = ["a", "b", "c"].map((id) => list(id)).reverse();
  const next = upsertOfflineList(all, { ...list("a"), ticks: ["x"] });
  assert.deepEqual(next.map((l) => l.id), ["a", "c", "b"]);
  assert.deepEqual(next[0].ticks, ["x"]);
});

test("upsertOfflineList respects a custom max", () => {
  const next = upsertOfflineList([list("a"), list("b")], list("c"), 2);
  assert.deepEqual(next.map((l) => l.id), ["c", "a"]);
});

test("mergeTicks prefers offline ticks when newer, site ticks otherwise", () => {
  assert.deepEqual(mergeTicks(["a"], ["b", "c"], true), ["b", "c"]);
  assert.deepEqual(mergeTicks(["a"], ["b", "c"], false), ["a"]);
});
