import "server-only";
import { createHash } from "node:crypto";
import { admin } from "@/lib/supabase/admin";
import { intEnv } from "@/lib/env";

export type Allowance =
  | { ok: true; remaining: number | null }
  | { ok: false; code: "site_cap" | "anon_limit" | "free_limit" | "plus_limit" | "ip_limit"; message: string };

/** Receipt checks are logged in `scans` (for cost tracking and the site-wide cap) under this marker, not against dish-scan quotas. */
export const RECEIPT_SCAN = "receipt";
/** "Make something new with my leftovers" requests: same idea, their own daily limit. */
export const LEFTOVER_SCAN = "leftovers";
/** Admin "write a week of trivia" calls: counted toward the site cap only. */
export const TRIVIA_SCAN = "trivia";
/** "Add my own recipe": Claude prices a cook's own recipe. Its own daily limit (OWN_RECIPES_PER_DAY). */
export const OWN_SCAN = "own";

export function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  return createHash("sha256")
    .update((process.env.IP_HASH_SALT ?? "plateful") + ip)
    .digest("hex")
    .slice(0, 32);
}

function startOfUtcDay() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}

const EVER = "1970-01-01T00:00:00Z";

async function countScans(filter: { column: "user_id" | "visitor_id" | "ip_hash"; value: string } | null, since: string, before?: number) {
  // Only scans Claude actually processed (and billed) count, plus calls in flight (held with 0 tokens).
  // Failures that weren't billed have no tokens. `before`: count only rows held earlier than this one (see guardedCall).
  let q = admin()
    .from("scans")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since)
    .not("input_tokens", "is", null);
  if (before !== undefined) q = q.lt("id", before);
  if (filter) q = q.eq(filter.column, filter.value).or(`ip_hash.is.null,ip_hash.not.in.(${RECEIPT_SCAN},${LEFTOVER_SCAN},${TRIVIA_SCAN},${OWN_SCAN})`);
  const { count, error } = await q;
  if (error) throw new Error(`Couldn't read the scans table (${error.code ?? "no code"}): ${error.message}`);
  return count ?? 0;
}

/**
 * Decides whether this request may run a paid photo scan.
 * Order: site-wide daily cap first (protects the bill), then per-person limits.
 */
export async function checkScanAllowance(who: {
  userId: string | null;
  visitorId: string | null;
  ipHash: string | null;
  plus: boolean;
}, before?: number): Promise<Allowance> {
  const today = startOfUtcDay();

  const siteCap = intEnv("DAILY_SCAN_CAP", 2000);
  if ((await countScans(null, today, before)) >= siteCap) {
    return {
      ok: false,
      code: "site_cap",
      message: "We've hit today's scan limit while we scale up. Try a sample dish, or come back tomorrow.",
    };
  }

  // A single IP can't burn through limits by clearing cookies. Allows a few, since households and offices share IPs.
  if (who.ipHash && !who.userId) {
    const ipDay = await countScans({ column: "ip_hash", value: who.ipHash }, today, before);
    if (ipDay >= intEnv("GUEST_IP_SCANS_PER_DAY", 5)) {
      return { ok: false, code: "ip_limit", message: "Too many scans from this network today. Sign in to keep going." };
    }
  }

  if (who.userId && who.plus) {
    const limit = intEnv("PLUS_SCANS_PER_DAY", 40);
    const used = await countScans({ column: "user_id", value: who.userId }, today, before);
    return used < limit
      ? { ok: true, remaining: limit - used }
      : { ok: false, code: "plus_limit", message: `You've used today's ${limit} scans. They reset at midnight UTC.` };
  }

  if (who.userId) {
    const limit = intEnv("FREE_SCANS_PER_WEEK", 3);
    const used = await countScans({ column: "user_id", value: who.userId }, daysAgo(7), before);
    return used < limit
      ? { ok: true, remaining: limit - used }
      : {
          ok: false,
          code: "free_limit",
          message: `You've used your ${limit} free scans this week. Plus gives you up to ${intEnv("PLUS_SCANS_PER_DAY", 40)} a day.`,
        };
  }

  // Guests get a taste (one scan by default, ever), then sign in for the weekly free scans.
  if (who.visitorId) {
    const limit = intEnv("GUEST_SCANS", 1);
    const used = await countScans({ column: "visitor_id", value: who.visitorId }, EVER, before);
    return used < limit
      ? { ok: true, remaining: limit - used }
      : {
          ok: false,
          code: "anon_limit",
          message: `That was your free scan. Sign in free to get ${intEnv("FREE_SCANS_PER_WEEK", 3)} a week and save your recipes.`,
        };
  }

  return { ok: false, code: "anon_limit", message: "Enable cookies to scan a photo, or sign in." };
}

export async function recordScan(row: {
  userId: string | null;
  visitorId: string | null;
  ipHash: string | null;
  ok: boolean;
  inputTokens?: number;
  outputTokens?: number;
}) {
  await admin()
    .from("scans")
    .insert({
      user_id: row.userId,
      visitor_id: row.visitorId,
      ip_hash: row.ipHash,
      ok: row.ok,
      input_tokens: row.inputTokens ?? null,
      output_tokens: row.outputTokens ?? null,
    });
}

/** Site-wide daily cap on paid Claude calls (dish scans, receipts, leftover recipes, own recipes and trivia together). */
export async function siteCapReached(before?: number) {
  return (await countScans(null, startOfUtcDay(), before)) >= intEnv("DAILY_SCAN_CAP", 2000);
}

/** How many of one kind of paid call (marker in `ip_hash`) this person made since `since`; same counting rules as above. */
export async function countMarked(userId: string, marker: string, since: string, before?: number) {
  let q = admin()
    .from("scans")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("ip_hash", marker)
    .not("input_tokens", "is", null)
    .gte("created_at", since);
  if (before !== undefined) q = q.lt("id", before);
  const { count } = await q;
  return count ?? 0;
}

type Tokens = { inputTokens: number; outputTokens: number };

/**
 * Runs a paid Claude call so that requests sent at the same moment can't all slip under a limit.
 * Like taking a ticket at the deli counter: we hold a `scans` row first (0 tokens, so it already counts),
 * then check the limits counting only tickets taken before ours. After the call the row gets the real numbers.
 * `check` returns null when allowed, or the message to show. `billedOnError` keeps the row counted when the
 * call failed after Claude charged for it (a refusal or a cut-off answer); other failures don't count.
 */
export async function guardedCall<T extends Tokens>(opts: {
  row: { userId: string | null; visitorId: string | null; ipHash: string | null };
  check: (before?: number) => Promise<string | null>;
  call: () => Promise<T>;
  ok?: (made: T) => boolean;
  billedOnError?: (e: unknown) => boolean;
}): Promise<{ ok: true; made: T } | { ok: false; limit: string } | { ok: false; error: unknown }> {
  const early = await opts.check();
  if (early) return { ok: false, limit: early };
  const db = admin();
  const { data: held, error: holdError } = await db
    .from("scans")
    .insert({ user_id: opts.row.userId, visitor_id: opts.row.visitorId, ip_hash: opts.row.ipHash, ok: false, input_tokens: 0, output_tokens: 0 })
    .select("id")
    .single();
  if (holdError || !held) throw new Error(`Couldn't write to the scans table: ${holdError?.message ?? "no row"}`);
  const late = await opts.check(held.id);
  if (late) {
    await db.from("scans").delete().eq("id", held.id);
    return { ok: false, limit: late };
  }
  try {
    const made = await opts.call();
    await db
      .from("scans")
      .update({ ok: opts.ok ? opts.ok(made) : true, input_tokens: made.inputTokens, output_tokens: made.outputTokens })
      .eq("id", held.id);
    return { ok: true, made };
  } catch (e) {
    const billed = opts.billedOnError?.(e) ?? false;
    await db.from("scans").update(billed ? { ok: false } : { ok: false, input_tokens: null, output_tokens: null }).eq("id", held.id);
    return { ok: false, error: e };
  }
}
