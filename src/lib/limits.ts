import "server-only";
import { createHash } from "node:crypto";
import { admin } from "@/lib/supabase/admin";
import { intEnv } from "@/lib/env";

export type Allowance =
  | { ok: true; remaining: number | null }
  | { ok: false; code: "site_cap" | "anon_limit" | "free_limit" | "plus_limit" | "ip_limit"; message: string };

/** Receipt checks are logged in `scans` (for cost tracking and the site-wide cap) under this marker, not against dish-scan quotas. */
export const RECEIPT_SCAN = "receipt";

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

async function countScans(filter: { column: "user_id" | "visitor_id" | "ip_hash"; value: string } | null, since: string) {
  // Only scans Claude actually processed (and billed) count. Failures before or at the API call have no tokens.
  let q = admin()
    .from("scans")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since)
    .not("input_tokens", "is", null);
  if (filter) q = q.eq(filter.column, filter.value).or(`ip_hash.is.null,ip_hash.neq.${RECEIPT_SCAN}`);
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
}): Promise<Allowance> {
  const today = startOfUtcDay();

  const siteCap = intEnv("DAILY_SCAN_CAP", 2000);
  if ((await countScans(null, today)) >= siteCap) {
    return {
      ok: false,
      code: "site_cap",
      message: "We've hit today's scan limit while we scale up. Try a sample dish, or come back tomorrow.",
    };
  }

  // A single IP can't burn through limits by clearing cookies. Generous, since offices and dorms share IPs.
  if (who.ipHash && !who.userId) {
    const ipDay = await countScans({ column: "ip_hash", value: who.ipHash }, today);
    if (ipDay >= intEnv("ANON_SCANS_PER_DAY", 3) * 5) {
      return { ok: false, code: "ip_limit", message: "Too many scans from this network today. Sign in to keep going." };
    }
  }

  if (who.userId && who.plus) {
    const limit = intEnv("PLUS_SCANS_PER_DAY", 40);
    const used = await countScans({ column: "user_id", value: who.userId }, today);
    return used < limit
      ? { ok: true, remaining: limit - used }
      : { ok: false, code: "plus_limit", message: `You've used today's ${limit} scans. They reset at midnight UTC.` };
  }

  if (who.userId) {
    const limit = intEnv("FREE_SCANS_PER_WEEK", 5);
    const used = await countScans({ column: "user_id", value: who.userId }, daysAgo(7));
    return used < limit
      ? { ok: true, remaining: limit - used }
      : {
          ok: false,
          code: "free_limit",
          message: `You've used your ${limit} free scans this week. Upgrade to Plus for unlimited copycats.`,
        };
  }

  if (who.visitorId) {
    const limit = intEnv("ANON_SCANS_PER_DAY", 3);
    const used = await countScans({ column: "visitor_id", value: who.visitorId }, today);
    return used < limit
      ? { ok: true, remaining: limit - used }
      : {
          ok: false,
          code: "anon_limit",
          message: `That's ${limit} free scans for today. Sign in free to get ${intEnv("FREE_SCANS_PER_WEEK", 5)} a week and save your recipes.`,
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
