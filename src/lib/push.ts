// Push notification rules. Pure functions (plus the APNs token signer), covered by push.test.ts.
// Notifications are opt-in, at most one of each kind a day, and never contain trivia answers.
// Server-side only: the signer uses node:crypto, so client code must not import this file.
import { createPrivateKey, sign } from "node:crypto";
import type { PlanSlot } from "./planner.ts";

export type PushKind = "daily_games" | "plan_dinner";
export const PUSH_KINDS: readonly PushKind[] = ["daily_games", "plan_dinner"];

export const FALLBACK_TIME_ZONE = "America/New_York";

/** An APNs device token as the app sends it (hex). */
export const PUSH_TOKEN_RE = /^[0-9a-fA-F]{64,200}$/;
/** Local hour of day each kind goes out. */
export const DAILY_GAMES_HOUR = 9;
export const PLAN_DINNER_HOUR = 16;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function dailyGamesMessage() {
  return { title: "Today's Yumjack trivia is ready", body: "3 quick food questions. Keep your streak going.", url: "/trivia" };
}

export function dinnerMessage(dish: string) {
  return { title: `Tonight: ${dish}`, body: `Your plan says it's ${dish} for dinner. The recipe's ready.`, url: "/plan" };
}

/** True when Intl accepts the name. */
export function validTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || !tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function parts(now: Date, timeZone: string | null) {
  const tz = validTimeZone(timeZone) ? timeZone : FALLBACK_TIME_ZONE;
  const f = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" });
  const list = f.formatToParts(now);
  const get = (t: string) => list.find((p) => p.type === t)?.value ?? "";
  return { y: get("year"), m: get("month"), d: get("day"), h: Number(get("hour")) % 24 };
}

/** Hour of day (0-23) on the cook's clock. Unknown or bad time zones count as US Eastern. */
export function localHour(now: Date, timeZone: string | null): number {
  return parts(now, timeZone).h;
}

/** The cook's calendar date, YYYY-MM-DD. */
export function localDate(now: Date, timeZone: string | null): string {
  const p = parts(now, timeZone);
  return `${p.y}-${p.m}-${p.d}`;
}

export function dailyGamesDue(i: {
  now: Date;
  timeZone: string | null;
  enabled: boolean;
  dayApproved: boolean;
  playedToday: boolean;
  alreadySent: boolean;
}): boolean {
  return i.enabled && i.dayApproved && !i.playedToday && !i.alreadySent && localHour(i.now, i.timeZone) === DAILY_GAMES_HOUR;
}

/** Monday = 0, like the labels on the plan page. */
function weekdayIndex(date: string): number {
  return (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
}

/** The dinner recipe id for the cook's local today, or null when the plan is too old, doesn't reach today, or has no dinner then. */
export function planDinnerToday(i: { now: Date; timeZone: string | null; planCreatedAt: string; days: number; slots: PlanSlot[] }): string | null {
  const created = new Date(i.planCreatedAt).getTime();
  if (!Number.isFinite(created) || i.now.getTime() - created > WEEK_MS) return null;
  const index = weekdayIndex(localDate(i.now, i.timeZone));
  if (index >= i.days) return null;
  return i.slots.find((s) => s.day === index && s.meal === "dinner" && s.id)?.id ?? null;
}

export function dinnerDue(i: {
  now: Date;
  timeZone: string | null;
  enabled: boolean;
  plus: boolean;
  recipeId: string | null;
  alreadySent: boolean;
}): boolean {
  return i.enabled && i.plus && !!i.recipeId && !i.alreadySent && localHour(i.now, i.timeZone) === PLAN_DINNER_HOUR;
}

const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64url");

/** An APNs provider token: ES256 over {kid}.{iss, iat}. The key is the .p8 PEM; literal "\n" sequences are accepted. */
export function signApnsJwt(pem: string, keyId: string, teamId: string, nowSeconds: number): string {
  const key = createPrivateKey(pem.replace(/\\n/g, "\n"));
  const data = `${b64url(JSON.stringify({ alg: "ES256", kid: keyId }))}.${b64url(JSON.stringify({ iss: teamId, iat: nowSeconds }))}`;
  const sig = sign("sha256", Buffer.from(data), { key, dsaEncoding: "ieee-p1363" });
  return `${data}.${b64url(sig)}`;
}
