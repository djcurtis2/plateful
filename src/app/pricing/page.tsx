import type { Metadata } from "next";
import { getMe } from "@/lib/data";
import { intEnv } from "@/lib/env";
import { LAUNCH_CODE, PLUS_MONTHLY, PLUS_YEARLY, PLUS_YEARLY_SAVES, REFERRAL_GOAL, REFERRAL_MAX_REWARDS } from "@/lib/plan";

export const metadata: Metadata = { title: "Pricing" };

export default async function PricingPage() {
  const me = await getMe();
  const free = intEnv("FREE_SCANS_PER_WEEK", 3);
  const plusDaily = intEnv("PLUS_SCANS_PER_DAY", 40);
  const yearlyOn = !!process.env.STRIPE_PRICE_PLUS_YEARLY;
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-10 pt-10">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="font-display text-5xl font-bold tracking-tight">Cook more. Pay less than one entrée.</h1>
        <p className="text-muted">Every recipe page, cart and share card is free. Plus is for people who cook copycats all week.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <section className="card flex flex-col gap-4 p-6">
          <h2 className="font-display text-2xl font-bold">Free</h2>
          <p className="tabular font-mono text-4xl">$0</p>
          <ul className="flex flex-col gap-2 text-sm">
            <li>{free} photo scans a week</li>
            <li>Unlimited recipe pages, carts and share cards</li>
            <li>Pantry that remembers what you have</li>
            <li>See what each recipe leaves over, plus one idea to use it up</li>
            <li>Diet profile: filter recipes, suggestions and plans to fit how you eat</li>
            <li>Weekly cook-off entries</li>
          </ul>
        </section>
        <section className="card flex flex-col gap-4 border-basil p-6">
          <h2 className="font-display text-2xl font-bold">Plus</h2>
          <p className="tabular font-mono text-4xl">
            {PLUS_MONTHLY}<span className="text-base text-muted">/month</span>
          </p>
          {yearlyOn && (
            <p className="-mt-3 text-sm text-muted">
              or {PLUS_YEARLY} a year (save {PLUS_YEARLY_SAVES})
            </p>
          )}
          <ul className="flex flex-col gap-2 text-sm">
            <li>Up to {plusDaily} photo scans a day</li>
            <li>Plan my week: every meal and snack, sharing groceries, one shopping list</li>
            <li>Every recipe that uses up your leftovers</li>
            <li>New recipes written around your leftovers, up to 15 a day</li>
            <li>Make any recipe your way: vegetarian, gluten-free, lighter, air fryer and more</li>
            <li>Everything in Free</li>
            <li>Early access to new features</li>
          </ul>
          {me?.plus ? (
            <a href="/account" className="btn btn-ghost">
              You have Plus
            </a>
          ) : (
            <div className="flex flex-col gap-2">
              <form action="/api/stripe/checkout" method="post">
                <button className="btn btn-primary w-full">
                  {me ? `Upgrade to Plus · ${PLUS_MONTHLY}/month` : "Sign in to upgrade"}
                </button>
              </form>
              {me && yearlyOn && (
                <form action="/api/stripe/checkout" method="post">
                  <input type="hidden" name="interval" value="year" />
                  <button className="btn btn-ghost w-full">
                    Pay yearly · {PLUS_YEARLY} (save {PLUS_YEARLY_SAVES})
                  </button>
                </form>
              )}
            </div>
          )}
          {!me?.plus && (
            <p className="text-center text-xs text-muted">
              Launch offer: use code <span className="font-mono font-semibold text-ink">{LAUNCH_CODE}</span> at checkout for $5 off your first payment.
            </p>
          )}
        </section>
      </div>
      <p className="text-center text-sm text-muted">
        Or get Plus free: every {REFERRAL_GOAL} friends who cook from your link earns you a month (up to {REFERRAL_MAX_REWARDS}).
      </p>
    </main>
  );
}
