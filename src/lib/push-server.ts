import "server-only";
import http2 from "node:http2";
import { admin } from "@/lib/supabase/admin";
import { hasPlus } from "@/lib/plan";
import { legacySlots, normalizeSettings, type PlanSlot } from "@/lib/planner";
import { TRIVIA_PER_DAY, triviaDay } from "@/lib/trivia";
import { triviaQuestions } from "@/lib/trivia-server";
import {
  DAILY_GAMES_HOUR,
  PLAN_DINNER_HOUR,
  dailyGamesDue,
  dailyGamesMessage,
  dinnerDue,
  dinnerMessage,
  localDate,
  localHour,
  planDinnerToday,
  signApnsJwt,
  type PushKind,
} from "@/lib/push";

type Message = { title: string; body: string; url: string };

const apnsConfig = () => {
  const key = process.env.APNS_KEY_P8;
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APPLE_TEAM_ID;
  const topic = process.env.APPLE_BUNDLE_ID;
  return key && keyId && teamId && topic ? { key, keyId, teamId, topic } : null;
};

let jwtCache: { token: string; at: number } | null = null;
const JWT_MS = 50 * 60 * 1000; // Apple wants a fresh token between 20 and 60 minutes old

/** The APNs provider token, signed with the .p8 key and reused for 50 minutes. */
export function apnsJwt(now: Date): string {
  const c = apnsConfig();
  if (!c) throw new Error("APNs is not configured");
  if (jwtCache && now.getTime() - jwtCache.at < JWT_MS) return jwtCache.token;
  const token = signApnsJwt(c.key, c.keyId, c.teamId, Math.floor(now.getTime() / 1000));
  jwtCache = { token, at: now.getTime() };
  return token;
}

let session: http2.ClientHttp2Session | null = null;
function apnsSession() {
  if (session && !session.closed && !session.destroyed) return session;
  const s = http2.connect(`https://${process.env.APNS_HOST ?? "api.push.apple.com"}`);
  const drop = () => {
    if (session === s) session = null;
  };
  s.on("error", drop);
  s.on("close", drop);
  s.on("goaway", drop);
  s.unref();
  session = s;
  return s;
}

/** One alert push. "gone" means Apple says the token is dead and should be deleted. */
export async function sendApns(token: string, payload: Message): Promise<"ok" | "gone" | "error"> {
  const c = apnsConfig();
  if (!c) return "error";
  try {
    const jwt = apnsJwt(new Date());
    return await new Promise<"ok" | "gone" | "error">((resolve) => {
      const req = apnsSession().request({
        ":method": "POST",
        ":path": `/3/device/${token}`,
        authorization: `bearer ${jwt}`,
        "apns-topic": c.topic,
        "apns-push-type": "alert",
        "apns-priority": "10",
      });
      let status = 0;
      let body = "";
      const timer = setTimeout(() => {
        // A dead socket would hang every later send too: drop it so the next one reconnects.
        session?.destroy();
        session = null;
        resolve("error");
      }, 15_000);
      req.setEncoding("utf8");
      req.on("response", (h) => {
        status = Number(h[":status"] ?? 0);
      });
      req.on("data", (d: string) => (body += d));
      req.on("error", () => {
        clearTimeout(timer);
        resolve("error");
      });
      req.on("end", () => {
        clearTimeout(timer);
        if (status === 200) return resolve("ok");
        let reason = "";
        try {
          reason = JSON.parse(body).reason ?? "";
        } catch {
          // no body
        }
        if (status === 403 && (reason === "ExpiredProviderToken" || reason === "InvalidProviderToken")) jwtCache = null;
        if (status === 410 || (status === 400 && (reason === "BadDeviceToken" || reason === "Unregistered"))) return resolve("gone");
        console.error("apns rejected", status, reason);
        resolve("error");
      });
      req.end(JSON.stringify({ aps: { alert: { title: payload.title, body: payload.body }, sound: "default" }, url: payload.url }));
    });
  } catch (e) {
    console.error("apns send failed", e);
    return "error";
  }
}

const chunks = <T,>(list: T[], n: number) => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n));
const IN_BATCH = 150;

/** The notification choices a cook has saved (for the account page and prompts). */
export async function myNotify(userId: string): Promise<Record<PushKind, boolean>> {
  const { data } = await admin().from("profiles").select("notify").eq("id", userId).maybeSingle();
  const n = (data?.notify ?? {}) as Record<string, unknown>;
  return { daily_games: n.daily_games === true, plan_dinner: n.plan_dinner === true };
}

/**
 * Hourly job. For every opted-in cook whose local clock says it's time, claims today's send (so a retry never doubles it),
 * pushes to all their phones and deletes phones Apple says are gone.
 */
export async function runPushTick(now: Date): Promise<{ sent: number; pruned: number }> {
  if (!apnsConfig()) return { sent: 0, pruned: 0 };
  try {
    return await tick(now);
  } finally {
    // One connection per tick: a socket kept on a warm serverless instance may be dead by next hour.
    session?.close();
    session = null;
  }
}

const MAX_DEVICES = 5;

async function tick(now: Date): Promise<{ sent: number; pruned: number }> {
  const db = admin();

  const { data: profiles } = await db
    .from("profiles")
    .select("id, plan, subscription_status, bonus_until, apple_until, notify")
    .or("notify->>daily_games.eq.true,notify->>plan_dinner.eq.true")
    .limit(10000);
  if (!profiles?.length) return { sent: 0, pruned: 0 };

  const devices: { user_id: string; token: string; time_zone: string | null }[] = [];
  for (const ids of chunks(profiles.map((p) => p.id), IN_BATCH)) {
    const { data } = await db.from("push_devices").select("user_id, token, time_zone").in("user_id", ids).order("last_seen_at", { ascending: false });
    devices.push(...(data ?? []));
  }
  const byUser = new Map<string, typeof devices>();
  for (const d of devices) byUser.set(d.user_id, [...(byUser.get(d.user_id) ?? []), d]); // newest first

  // Only cooks whose local hour matches need any further lookups.
  const gamesFor: string[] = [];
  const dinnerFor: string[] = [];
  const profileById = new Map(profiles.map((p) => [p.id, p]));
  for (const p of profiles) {
    const mine = byUser.get(p.id);
    if (!mine?.length) continue;
    const tz = mine[0].time_zone;
    const notify = (p.notify ?? {}) as Record<string, unknown>;
    const hour = localHour(now, tz);
    if (notify.daily_games === true && hour === DAILY_GAMES_HOUR) gamesFor.push(p.id);
    if (notify.plan_dinner === true && hour === PLAN_DINNER_HOUR && hasPlus(p, now)) dinnerFor.push(p.id);
  }

  const jobs: { userId: string; kind: PushKind; day: string; message: Message }[] = [];

  if (gamesFor.length) {
    const today = triviaDay(now);
    const dayApproved = (await triviaQuestions(today)).length === TRIVIA_PER_DAY;
    const played = new Set<string>();
    if (dayApproved) {
      for (const ids of chunks(gamesFor, IN_BATCH)) {
        const { data } = await db.from("trivia_plays").select("user_id").eq("day", today).not("finished_at", "is", null).in("user_id", ids);
        for (const r of data ?? []) played.add(r.user_id);
      }
    }
    for (const id of gamesFor) {
      const tz = byUser.get(id)![0].time_zone;
      if (dailyGamesDue({ now, timeZone: tz, enabled: true, dayApproved, playedToday: played.has(id), alreadySent: false })) {
        jobs.push({ userId: id, kind: "daily_games", day: localDate(now, tz), message: dailyGamesMessage() });
      }
    }
  }

  if (dinnerFor.length) {
    const since = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString();
    const newest = new Map<string, { created_at: string; settings: unknown; slots: unknown; recipe_ids: string[] }>();
    for (const ids of chunks(dinnerFor, IN_BATCH)) {
      const { data } = await db
        .from("meal_plans")
        .select("user_id, settings, slots, recipe_ids, created_at")
        .in("user_id", ids)
        .gte("created_at", since)
        .order("created_at", { ascending: false });
      for (const r of data ?? []) if (!newest.has(r.user_id)) newest.set(r.user_id, r);
    }
    const picks: { userId: string; tz: string | null; recipeId: string }[] = [];
    for (const id of dinnerFor) {
      const plan = newest.get(id);
      if (!plan) continue;
      const tz = byUser.get(id)![0].time_zone;
      const slots = (plan.slots as PlanSlot[] | null) ?? legacySlots(plan.recipe_ids ?? []);
      const recipeId = planDinnerToday({ now, timeZone: tz, planCreatedAt: plan.created_at, days: normalizeSettings(plan.settings as never).days, slots });
      if (recipeId) picks.push({ userId: id, tz, recipeId });
    }
    const dishes = new Map<string, string>();
    for (const ids of chunks([...new Set(picks.map((p) => p.recipeId))], IN_BATCH)) {
      const { data } = await db.from("recipes").select("id, dish").in("id", ids);
      for (const r of data ?? []) dishes.set(r.id, r.dish);
    }
    for (const p of picks) {
      const dish = dishes.get(p.recipeId);
      const plus = hasPlus(profileById.get(p.userId), now);
      if (dish && dinnerDue({ now, timeZone: p.tz, enabled: true, plus, recipeId: p.recipeId, alreadySent: false })) {
        jobs.push({ userId: p.userId, kind: "plan_dinner", day: localDate(now, p.tz), message: dinnerMessage(dish) });
      }
    }
  }

  let sent = 0;
  const gone: string[] = [];
  for (const job of jobs) {
    // Claim first: only the call that actually inserts the row may send.
    const { data: claimed, error } = await db
      .from("push_sends")
      .upsert({ user_id: job.userId, kind: job.kind, day: job.day }, { onConflict: "user_id,kind,day", ignoreDuplicates: true })
      .select("user_id");
    if (error || !claimed?.length) continue;
    for (const d of (byUser.get(job.userId) ?? []).slice(0, MAX_DEVICES)) {
      const result = await sendApns(d.token, job.message);
      if (result === "ok") sent++;
      else if (result === "gone") gone.push(d.token);
    }
  }

  let pruned = 0;
  for (const tokens of chunks(gone, IN_BATCH)) {
    const { data } = await db.from("push_devices").delete().in("token", tokens).select("id");
    pruned += data?.length ?? 0;
  }
  return { sent, pruned };
}
