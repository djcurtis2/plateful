import { NextResponse, type NextRequest } from "next/server";
import { getMe } from "@/lib/data";
import { admin } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";
import { refreshFromStripe } from "@/lib/billing";
import { requireEnv, siteUrl } from "@/lib/env";

/** Starts a Stripe Checkout for Plus. Submitted as a form so it works without client JS. */
export async function POST(req: NextRequest) {
  const me = await getMe();
  if (!me) return NextResponse.redirect(new URL("/login?next=/pricing", req.url), { status: 303 });
  if (me.plus && me.profile?.plan === "plus") return NextResponse.redirect(new URL("/account", req.url), { status: 303 });

  let customer = me.profile?.stripe_customer_id ?? null;
  // Already paying (the profile may just not know yet, e.g. a second checkout tab): don't start a second subscription.
  if (customer) {
    const live = await stripe().subscriptions.list({ customer, status: "all", limit: 10 });
    if (live.data.some((s) => ["active", "trialing", "past_due"].includes(s.status))) {
      await refreshFromStripe(me.user.id, customer);
      return NextResponse.redirect(new URL("/account", req.url), { status: 303 });
    }
  }
  if (!customer) {
    const c = await stripe().customers.create({ email: me.user.email, metadata: { user_id: me.user.id } });
    customer = c.id;
    await admin().from("profiles").update({ stripe_customer_id: customer }).eq("id", me.user.id);
  }

  // Yearly only when its Stripe price is set up; anything else gets monthly.
  const form = await req.formData().catch(() => null);
  const yearly = form?.get("interval") === "year" && !!process.env.STRIPE_PRICE_PLUS_YEARLY;
  const price = yearly ? requireEnv("STRIPE_PRICE_PLUS_YEARLY") : requireEnv("STRIPE_PRICE_PLUS_MONTHLY");

  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer,
    client_reference_id: me.user.id,
    line_items: [{ price, quantity: 1 }],
    allow_promotion_codes: true,
    subscription_data: { metadata: { user_id: me.user.id } },
    success_url: `${siteUrl}/account?upgraded=1`,
    cancel_url: `${siteUrl}/pricing`,
  });

  return NextResponse.redirect(session.url!, { status: 303 });
}
