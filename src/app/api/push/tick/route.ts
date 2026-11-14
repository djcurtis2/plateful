import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { runPushTick } from "@/lib/push-server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(header: string | null): boolean {
  const secret = process.env.PUSH_CRON_SECRET;
  if (!secret || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Called every hour by the database's cron job (see migration 0019). Sends whatever is due on cooks' local clocks. */
export async function POST(req: NextRequest) {
  if (!authorized(req.headers.get("x-cron-secret"))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await runPushTick(new Date()));
  } catch (e) {
    console.error("push tick failed", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
