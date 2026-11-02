import { NextResponse, type NextRequest } from "next/server";
import { getMe } from "@/lib/data";
import { admin } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";
import { siteUrl } from "@/lib/env";
import { gearMetadata, purchasable } from "@/lib/avatar";

/**
 * Starts a one-time Stripe Checkout for a shop item or bundle. Submitted as a form (field `item` or `bundle`).
 * The price and item list come from the catalog and what this person already owns, never from the browser.
 */
export async function POST(req: NextRequest) {
  const back = NextResponse.redirect(new URL("/chef?tab=shop", req.url), { status: 303 });
  const me = await getMe();
  if (!me) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent("/chef?tab=shop")}`, req.url), { status: 303 });

  const form = await req.formData().catch(() => null);
  const item = form?.get("item");
  const bundle = form?.get("bundle");
  const target = typeof item === "string" && item ? { item } : typeof bundle === "string" && bundle ? { bundle } : null;
  if (!target) return back;

  const { data: gear, error } = await admin().from("user_gear").select("item_id").eq("user_id", me.user.id);
  if (error) return back;
  const buy = purchasable(target, (gear ?? []).map((g) => g.item_id));
  if (!buy) return back;

  let customer = me.profile?.stripe_customer_id ?? null;
  if (!customer) {
    const c = await stripe().customers.create({ email: me.user.email, metadata: { user_id: me.user.id } });
    customer = c.id;
    await admin().from("profiles").update({ stripe_customer_id: customer }).eq("id", me.user.id);
  }

  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    // Cards only: they settle at checkout, so nobody pays for gear that is never delivered.
    allowed_payment_method_types: ["card"], // this SDK's name for the old payment_method_types
    customer,
    client_reference_id: me.user.id,
    line_items: [{ price_data: { currency: "usd", unit_amount: buy.cents, product_data: { name: buy.name } }, quantity: 1 }],
    metadata: { user_id: me.user.id, gear: gearMetadata(buy.items) },
    success_url: `${siteUrl}/chef?tab=wardrobe&bought={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/chef?tab=shop`,
  });

  return NextResponse.redirect(session.url!, { status: 303 });
}
