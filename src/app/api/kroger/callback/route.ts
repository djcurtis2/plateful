import { NextResponse, type NextRequest } from "next/server";
import { KROGER_COOKIE, cleanCartItems, safeBack, withResult, type KrogerTrip } from "@/lib/kroger";
import { sendToKrogerCart, shopperToken } from "@/lib/kroger-server";

/** Kroger sends the shopper back here after sign-in. We add the list to their cart and return to the page. */
export async function GET(req: NextRequest) {
  let trip: KrogerTrip | null = null;
  try {
    trip = JSON.parse(req.cookies.get(KROGER_COOKIE)?.value ?? "null") as KrogerTrip | null;
  } catch {
    /* bad cookie */
  }
  const back = safeBack(trip?.back);
  const done = (result: string) => {
    const res = NextResponse.redirect(new URL(withResult(back, result), req.url), { status: 303 });
    res.cookies.delete({ name: KROGER_COOKIE, path: "/api/kroger" });
    return res;
  };

  const q = req.nextUrl.searchParams;
  const code = q.get("code");
  if (q.get("error")) return done("cancel");
  if (!trip || !code || !trip.state || q.get("state") !== trip.state) return done("error");

  const items = cleanCartItems(trip.items);
  try {
    const added = await sendToKrogerCart(items, await shopperToken(code));
    return done(`${added}-${items.length}`);
  } catch (e) {
    console.error("kroger cart failed", e);
    return done("error");
  }
}
