import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { KROGER_COOKIE, cleanCartItems, safeBack, withResult, type KrogerTrip } from "@/lib/kroger";
import { krogerAuthorizeUrl, krogerConfigured } from "@/lib/kroger-server";

/**
 * "Send to Kroger cart" form posts here with `items` (JSON list of names) and `back` (this page).
 * We hold the list in a short-lived cookie and send the shopper to Kroger to sign in; /callback finishes.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const back = safeBack(form?.get("back"));
  const home = (result: string) => NextResponse.redirect(new URL(withResult(back, result), req.url), { status: 303 });
  if (!krogerConfigured()) return home("off");

  let raw: unknown = null;
  try {
    raw = JSON.parse(String(form?.get("items") ?? "[]"));
  } catch {
    /* bad list */
  }
  const items = cleanCartItems(raw);
  if (!items.length) return home("0-0");

  const trip: KrogerTrip = { state: randomBytes(16).toString("hex"), back, items };
  const res = NextResponse.redirect(krogerAuthorizeUrl(trip.state), { status: 303 });
  res.cookies.set(KROGER_COOKIE, JSON.stringify(trip), {
    httpOnly: true,
    secure: req.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/api/kroger",
    maxAge: 15 * 60,
  });
  return res;
}
