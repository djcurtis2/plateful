import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { refreshFromRevenueCat } from "@/lib/apple-billing-server";

/** At most one RevenueCat lookup per cook every 30 seconds (per server instance), so the API quota can't be run down. */
const WAIT_MS = 30_000;
const lastRun = new Map<string, number>();

/** The app calls this after an Apple purchase or restore, and when it opens, in case a webhook is late. Signed-in only. */
export async function POST() {
  const { data } = await (await createClient()).auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const now = Date.now();
  const last = lastRun.get(data.user.id);
  if (last !== undefined && now - last < WAIT_MS) return NextResponse.json({ ok: true, changed: false, throttled: true }, { status: 429 });
  lastRun.set(data.user.id, now);
  // Keep the map small: forget entries older than the wait.
  if (lastRun.size > 5000) for (const [id, t] of lastRun) if (now - t >= WAIT_MS) lastRun.delete(id);
  const changed = await refreshFromRevenueCat(data.user.id);
  return NextResponse.json({ ok: true, changed });
}
