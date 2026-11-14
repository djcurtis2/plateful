import { NextResponse, type NextRequest } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { parseRevenueCatEvent } from "@/lib/apple-billing";
import { recordAppleEvent } from "@/lib/apple-billing-server";

export const runtime = "nodejs";

/** Compares in constant time (hashing first so different lengths don't leak either). */
function sameSecret(given: string, expected: string): boolean {
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/**
 * Apple purchases, renewals, cancellations and refunds from RevenueCat. Set this URL and an Authorization header
 * value (the same as REVENUECAT_WEBHOOK_AUTH) in RevenueCat > Integrations > Webhooks.
 * Answers 200 for anything ignored or already recorded so RevenueCat stops retrying; 500 only on a database error.
 */
export async function POST(req: NextRequest) {
  const expected = process.env.REVENUECAT_WEBHOOK_AUTH;
  const given = req.headers.get("authorization");
  if (!expected || !given || !sameSecret(given, expected)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { event?: unknown } | null;
  const event = parseRevenueCatEvent(body?.event);
  if (!event) return NextResponse.json({ ignored: true });

  try {
    await recordAppleEvent(event);
  } catch (e) {
    console.error("revenuecat webhook failed", event.type, event.id, e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
