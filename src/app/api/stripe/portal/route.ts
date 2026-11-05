import { NextResponse, type NextRequest } from "next/server";
import { getMe } from "@/lib/data";
import { stripe } from "@/lib/stripe";
import { siteUrl } from "@/lib/env";

/** Sends a subscriber to Stripe's hosted billing portal to update cards or cancel. */
export async function POST(req: NextRequest) {
  const me = await getMe();
  const customer = me?.profile?.stripe_customer_id;
  if (!customer) return NextResponse.redirect(new URL("/pricing", req.url), { status: 303 });
  const session = await stripe()
    .billingPortal.sessions.create({ customer, return_url: `${siteUrl}/account?billing=1` })
    .catch((e) => {
      // A customer Stripe no longer knows, e.g. a test customer after going live.
      if (e?.code === "resource_missing") return null;
      throw e;
    });
  if (!session) return NextResponse.redirect(new URL("/pricing", req.url), { status: 303 });
  return NextResponse.redirect(session.url, { status: 303 });
}
