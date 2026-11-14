"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { plusOffers, type PlusSource } from "@/lib/app-shell";
import { PLUS_MONTHLY, PLUS_YEARLY } from "@/lib/plan";
import {
  APPLE_SUBSCRIPTIONS, appStorefront, openExternal, openStripeCheckout, rcBuyPackage, rcPlusPackages, rcRestore, rcSyncSite, useIsApp,
  type RcPackage, type RcResult,
} from "@/lib/native";

/** Shows its children on the website only (things like Stripe prices and the launch code, which don't apply in the app). */
export function WebOnly({ children }: { children: ReactNode }) {
  return useIsApp() ? null : <>{children}</>;
}

type Props = {
  /** Signed-in cook, or null. */
  userId: string | null;
  source: PlusSource;
  /** Stripe's yearly price is set up. */
  yearlyOn: boolean;
  /** Account page: who to send to for managing an existing subscription. */
  manage?: { apple: boolean; stripe: boolean };
  /** What the website shows: today's Stripe buttons, unchanged. */
  children: ReactNode;
};

/**
 * Plus buy buttons. On the website: the children (Stripe forms). In the iPhone app: Subscribe with Apple at Apple's own
 * prices, Pay on yumjack.app (US App Store only), and Restore purchases. Never offers a second way to pay for Plus someone has.
 */
export function PlusBuyButtons({ userId, source, yearlyOn, manage, children }: Props) {
  const app = useIsApp();
  const router = useRouter();
  const [storefront, setStorefront] = useState<string | null>(null);
  const [packages, setPackages] = useState<{ monthly: RcPackage | null; yearly: RcPackage | null } | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const offers = plusOffers(source, storefront);
  useEffect(() => {
    if (!app) return;
    let live = true;
    void appStorefront().then((s) => live && setStorefront(s));
    if (offers.apple && userId) void rcPlusPackages().then((p) => live && setPackages(p));
    return () => {
      live = false;
    };
  }, [app, offers.apple, userId]);

  if (!app) return <>{children}</>;

  async function run(step: () => Promise<RcResult>, success: string) {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const r = await step();
      if (r.ok) {
        await rcSyncSite();
        setDone(success);
        router.refresh();
      } else if (!r.cancelled) {
        setError(r.message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function payOnSite(interval: "month" | "year") {
    setBusy(true);
    setError(null);
    try {
      const err = await openStripeCheckout("/api/stripe/checkout", { interval }, () => router.refresh());
      if (err) setError(err);
    } finally {
      setBusy(false);
    }
  }

  const managing = !!(manage?.apple || manage?.stripe);
  return (
    <div className="flex flex-col gap-2">
      {manage?.apple && (
        <button type="button" className="btn btn-ghost" onClick={() => void openExternal(APPLE_SUBSCRIPTIONS)}>
          Manage in Apple
        </button>
      )}
      {manage?.stripe && (
        <form action="/api/stripe/portal" method="post">
          <button className="btn btn-ghost w-full">Manage billing</button>
        </form>
      )}
      {offers.note && !managing && <p className="text-center text-sm font-semibold text-basil">{offers.note}</p>}

      {!userId ? (
        offers.apple && (
          <Link href="/login?next=/pricing" className="btn btn-primary w-full">
            Sign in to upgrade
          </Link>
        )
      ) : (
        <>
          {offers.apple &&
            (packages === undefined ? (
              <p className="text-center text-sm text-muted">Getting Apple prices…</p>
            ) : packages === null ? (
              <p className="text-center text-sm text-muted">Apple purchases aren&apos;t available right now. Try again later.</p>
            ) : (
              <>
                {packages.monthly && (
                  <button type="button" className="btn btn-primary w-full" disabled={busy} onClick={() => void run(() => rcBuyPackage(userId, packages.monthly!), "Welcome to Plus.")}>
                    Subscribe with Apple · {packages.monthly.product.priceString}/month
                  </button>
                )}
                {packages.yearly && (
                  <button type="button" className="btn btn-ghost w-full" disabled={busy} onClick={() => void run(() => rcBuyPackage(userId, packages.yearly!), "Welcome to Plus.")}>
                    Subscribe with Apple · {packages.yearly.product.priceString}/year
                  </button>
                )}
                <p className="text-center text-xs text-muted">
                  Renews automatically until you cancel in iPhone Settings, at least a day before it renews. See the{" "}
                  <Link href="/terms" className="underline">terms</Link> and <Link href="/privacy" className="underline">privacy policy</Link>.
                </p>
              </>
            ))}
          {offers.stripe && (
            <div className="flex flex-col gap-1">
              <button type="button" className="btn btn-ghost w-full" disabled={busy} onClick={() => void payOnSite("month")}>
                Pay on yumjack.app · {PLUS_MONTHLY}/month
              </button>
              {yearlyOn && (
                <button type="button" className="btn btn-ghost w-full" disabled={busy} onClick={() => void payOnSite("year")}>
                  Pay yearly on yumjack.app · {PLUS_YEARLY}
                </button>
              )}
              <p className="text-center text-xs text-muted">Opens yumjack.app in a browser to pay by card.</p>
            </div>
          )}
          {!managing && (
            <button type="button" className="btn btn-ghost btn-sm self-center" disabled={busy} onClick={() => void run(() => rcRestore(userId), "Purchases restored.")}>
              Restore purchases
            </button>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="text-center text-sm text-chili">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="text-center text-sm font-semibold text-basil">
          {done}
        </p>
      )}
    </div>
  );
}
