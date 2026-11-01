import "server-only";
import Stripe from "stripe";
import { requireEnv } from "@/lib/env";

let client: Stripe | null = null;
export function stripe() {
  client ??= new Stripe(requireEnv("STRIPE_SECRET_KEY"));
  return client;
}

/** Newer Stripe API versions moved the period end onto subscription items; read whichever exists. */
export function periodEnd(sub: Stripe.Subscription): string | null {
  const fromItem = sub.items?.data?.[0] as unknown as { current_period_end?: number } | undefined;
  const fromSub = (sub as unknown as { current_period_end?: number }).current_period_end;
  const ts = fromItem?.current_period_end ?? fromSub;
  return ts ? new Date(ts * 1000).toISOString() : null;
}
