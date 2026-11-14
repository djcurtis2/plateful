import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { refreshFromRevenueCat } from "@/lib/apple-billing-server";

/**
 * Limits RevenueCat lookups per cook (per server instance) so the API quota can't be run down.
 * App-open checks and purchase/restore checks have separate limits, so a purchase right after
 * opening the app still updates at once.
 */
const WAIT_MS = { open: 30_000, purchase: 5_000 } as const;
const lastRun = new Map<string, number>();

/** The app calls this after an Apple purchase or restore (?on=purchase), and when it opens (?on=open), in case a webhook is late. Signed-in only. */
export async function POST(request: Request) {
  const { data } = await (await createClient()).auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const kind = new URL(request.url).searchParams.get("on") === "open" ? "open" : "purchase";
  const key = `${data.user.id}:${kind}`;
  const now = Date.now();
  const last = lastRun.get(key);
  if (last !== undefined && now - last < WAIT_MS[kind]) return NextResponse.json({ ok: true, changed: false, throttled: true }, { status: 429 });
  lastRun.set(key, now);
  // Keep the map small: forget entries older than the longest wait.
  if (lastRun.size > 5000) for (const [id, t] of lastRun) if (now - t >= WAIT_MS.open) lastRun.delete(id);
  const changed = await refreshFromRevenueCat(data.user.id);
  return NextResponse.json({ ok: true, changed });
}
