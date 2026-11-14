import { test } from "node:test";
import assert from "node:assert/strict";
import { withoutBlocked } from "./blocks.ts";

type Row = { id: string; user: string | null };
const rows: Row[] = [
  { id: "a", user: "u1" },
  { id: "b", user: "u2" },
  { id: "c", user: null },
  { id: "d", user: "u1" },
  { id: "e", user: "u3" },
];

test("withoutBlocked drops blocked users' rows, keeps null user ids, keeps order", () => {
  const out = withoutBlocked(rows, new Set(["u1"]), (r) => r.user);
  assert.deepEqual(out.map((r) => r.id), ["b", "c", "e"]);
});

test("withoutBlocked returns everything when nothing is blocked", () => {
  assert.deepEqual(withoutBlocked(rows, new Set(), (r) => r.user), rows);
});
