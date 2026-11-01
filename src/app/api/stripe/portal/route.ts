import { NextResponse, type NextRequest } from "next/server";
import { getMe } from "@/lib/data";
import { stripe } from "@/lib/stripe";
import { siteUrl } from "@/lib/env";

/** Sends a subscriber to Stripe's hosted billing portal to update cards or cancel. */
export async function POST(req: NextRequest) {
  const me = await getMe();
  const customer = me?.profile?.stripe_customer_id;
  if (!customer) return NextResponse.redirect(new URL("/pricing", req.url), { status: 303 });
  const session = await stripe().billingPortal.sessions.create({ customer, return_url: `${siteUrl}/account` });
  return NextResponse.redirect(session.url, { status: 303 });
}
