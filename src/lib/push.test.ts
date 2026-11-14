import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, verify } from "node:crypto";
import { dailyGamesDue, dinnerDue, localDate, localHour, planDinnerToday, signApnsJwt, dinnerMessage, dailyGamesMessage } from "./push.ts";
import type { PlanSlot } from "./planner.ts";

test("sydney 9am on the previous UTC day: no push if already played that UTC day", () => {
  const now = new Date("2026-12-01T22:00:00Z"); // 9am Dec 2 in Sydney, UTC day Dec 1
  const base = { now, timeZone: "Australia/Sydney", enabled: true, dayApproved: true, alreadySent: false };
  assert.equal(dailyGamesDue({ ...base, playedToday: true }), false);
  assert.equal(dailyGamesDue({ ...base, playedToday: false }), true);
});

test("not approved, not enabled, wrong hour or already sent: no push", () => {
  const ok = { now: new Date("2026-12-01T14:00:00Z"), timeZone: "America/New_York", enabled: true, dayApproved: true, playedToday: false, alreadySent: false };
  assert.equal(dailyGamesDue(ok), true);
  assert.equal(dailyGamesDue({ ...ok, dayApproved: false }), false);
  assert.equal(dailyGamesDue({ ...ok, enabled: false }), false);
  assert.equal(dailyGamesDue({ ...ok, now: new Date("2026-12-01T15:00:00Z") }), false);
  assert.equal(dailyGamesDue({ ...ok, alreadySent: true }), false);
});

test("bad time zone falls back to New York", () => {
  assert.equal(localHour(new Date("2026-12-01T14:00:00Z"), "Not/AZone"), 9);
  assert.equal(localHour(new Date("2026-12-01T14:00:00Z"), null), 9);
  assert.equal(localDate(new Date("2026-12-01T03:00:00Z"), null), "2026-11-30");
});

test("midnight is hour 0, not 24", () => {
  assert.equal(localHour(new Date("2026-12-01T05:00:00Z"), "America/New_York"), 0);
});

const slots: PlanSlot[] = [
  { day: 0, meal: "dinner", id: "a" },
  { day: 3, meal: "dinner", id: "d" },
  { day: 3, meal: "lunch", id: "l" },
  { day: 4, meal: "breakfast", id: "b" },
];

test("plan dinner by weekday label, stops after 7 days", () => {
  const planCreatedAt = "2026-12-02T12:00:00Z"; // Wednesday
  const thursday = new Date("2026-12-03T21:00:00Z"); // 4pm Thursday in New York
  assert.equal(planDinnerToday({ now: thursday, timeZone: "America/New_York", planCreatedAt, days: 5, slots }), "d");
  assert.equal(planDinnerToday({ now: new Date("2026-12-10T21:00:00Z"), timeZone: "America/New_York", planCreatedAt, days: 5, slots }), null); // 8 days later
  assert.equal(planDinnerToday({ now: thursday, timeZone: "America/New_York", planCreatedAt, days: 3, slots }), null); // index 3 >= 3 days
  assert.equal(planDinnerToday({ now: new Date("2026-12-04T21:00:00Z"), timeZone: "America/New_York", planCreatedAt, days: 5, slots }), null); // Friday: no dinner
});

test("dinner reminder needs Plus, a dinner, local 4pm and no earlier send", () => {
  const ok = { now: new Date("2026-12-03T21:00:00Z"), timeZone: "America/New_York", enabled: true, plus: true, recipeId: "d", alreadySent: false };
  assert.equal(dinnerDue(ok), true);
  assert.equal(dinnerDue({ ...ok, plus: false }), false);
  assert.equal(dinnerDue({ ...ok, recipeId: null }), false);
  assert.equal(dinnerDue({ ...ok, alreadySent: true }), false);
  assert.equal(dinnerDue({ ...ok, enabled: false }), false);
  assert.equal(dinnerDue({ ...ok, now: new Date("2026-12-03T20:00:00Z") }), false);
});

test("copy", () => {
  assert.deepEqual(dinnerMessage("Pad Thai"), { title: "Tonight: Pad Thai", body: "Your plan says it's Pad Thai for dinner. The recipe's ready.", url: "/plan" });
  assert.equal(dailyGamesMessage().url, "/trivia");
});

test("apns jwt is a valid ES256 signature (also with literal \\n in the key)", () => {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  for (const key of [pem, pem.replace(/\n/g, "\\n")]) {
    const jwt = signApnsJwt(key, "KEY1234567", "TEAM123456", 1_800_000_000);
    const [h, p, s] = jwt.split(".");
    assert.deepEqual(JSON.parse(Buffer.from(h, "base64url").toString()), { alg: "ES256", kid: "KEY1234567" });
    assert.deepEqual(JSON.parse(Buffer.from(p, "base64url").toString()), { iss: "TEAM123456", iat: 1_800_000_000 });
    const sig = Buffer.from(s, "base64url");
    assert.equal(sig.length, 64);
    assert.equal(verify("sha256", Buffer.from(`${h}.${p}`), { key: publicKey, dsaEncoding: "ieee-p1363" }, sig), true);
  }
});
