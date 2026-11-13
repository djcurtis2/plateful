import { PLUS_MONTHLY, PLUS_YEARLY, REFERRAL_MAX_REWARDS } from "@/lib/plan";
import type { Metadata } from "next";
import { DietForm } from "@/components/DietForm";
import { DeleteAccount } from "@/components/DeleteAccount";
import { BadgeIcon, LevelIcon, LevelLadder } from "@/components/GameIcons";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/data";
import { refreshFromStripe } from "@/lib/billing";
import { mySavings } from "@/lib/savings-server";
import { dollars, nextMilestone } from "@/lib/savings";
import { SavingsCard } from "@/components/SavingsCard";
import { FeatureMeToggle } from "@/components/FeatureMeToggle";
import { referralStats } from "@/lib/referrals";
import { siteUrl } from "@/lib/env";
import { CopyField } from "@/components/CopyField";
import { NameForm } from "@/components/NameForm";
import { playerStats } from "@/lib/game-server";
import { admin } from "@/lib/supabase/admin";
import { BADGES } from "@/lib/game";
import type { BadgeId } from "@/lib/database.types";
import Link from "next/link";
import { ChefAvatar } from "@/components/ChefAvatar";
import { chefCards } from "@/lib/avatar-server";
import { CLUB_BY_ID } from "@/lib/clubs";

export const metadata: Metadata = { title: "Account" };

function fmtDate(iso: string | null | undefined) {
  return iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;
}

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ upgraded?: string; billing?: string }> }) {
  let me = await getMe();
  if (!me || !me.profile) redirect("/login?next=/account");
  const { upgraded, billing } = await searchParams;
  // Back from checkout or the billing portal, or a paying customer whose webhook was missed: confirm with Stripe directly.
  if ((!me.plus || billing) && me.profile.stripe_customer_id && (await refreshFromStripe(me.user.id, me.profile.stripe_customer_id))) {
    me = (await getMe({ fresh: true }))!;
  }
  const p = me.profile!;
  const [stats, game, { data: prizes }, savings, cards] = await Promise.all([
    referralStats(me.user.id),
    playerStats(me.user.id, null),
    admin().from("prize_awards").select("id, kind, reason, detail, status, created_at").eq("user_id", me.user.id).order("created_at", { ascending: false }),
    mySavings(me.user.id),
    chefCards([me.user.id]),
  ]);
  const chef = cards[me.user.id];
  const goal = nextMilestone(savings.saved);
  const earned = new Set(game.badges.map((b) => b.badge));
  const link = `${siteUrl}/?ref=${p.referral_code}`;
  const paid = p.plan === "plus";
  const bonusUntil = p.bonus_until && new Date(p.bonus_until) > new Date() ? fmtDate(p.bonus_until) : null;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 pt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight">Account</h1>
          <p className="text-muted">{me.user.email}</p>
        </div>
        <form action="/auth/signout" method="post">
          <button className="btn btn-ghost btn-sm">Sign out</button>
        </form>
      </div>

      {upgraded && (
        <p className="rounded-2xl bg-basil px-4 py-3 font-medium text-basil-ink">Welcome to Plus. It can take a few seconds to show below.</p>
      )}

      <section id="savings" className="card flex scroll-mt-20 flex-col gap-5 border-saffron p-6">
        <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="flex flex-col gap-4">
            <div>
              <span className="label">Your savings</span>
              <p className="tabular font-mono text-5xl font-semibold text-basil">${savings.saved.toFixed(2)}</p>
              <p className="text-sm text-muted">
                vs. eating out · {savings.meals} {savings.meals === 1 ? "meal" : "meals"} cooked
                {savings.verified ? ` · ${savings.verified} with a photo` : ""} · {dollars(savings.month)} this month
              </p>
            </div>
            {goal ? (
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between text-xs text-muted">
                  <span>Next badge: Saved {dollars(goal.amount)}</span>
                  <span className="tabular font-mono">${goal.toGo.toFixed(2)} to go</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-sunk" role="progressbar" aria-label="Progress to next savings badge" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(goal.progress * 100)}>
                  <div className="h-full rounded-full bg-saffron" style={{ width: `${Math.round(goal.progress * 100)}%` }} />
                </div>
              </div>
            ) : (
              <p className="text-sm font-semibold text-basil">You&apos;ve earned every savings badge.</p>
            )}
            <p className="text-xs text-muted">
              Counted when you tap &ldquo;I made it,&rdquo; tick off a planned dinner, or post your version. Copycats compare to the restaurant&apos;s menu price; other recipes to a similar takeout dish. Estimates, one per recipe per day.
            </p>
            <FeatureMeToggle initial={!!p.feature_me} />
          </div>
          {savings.saved > 0 && <SavingsCard saved={savings.saved} meals={savings.meals} shareUrl={link} />}
        </div>
      </section>

      <section className="card flex flex-col gap-5 p-6">
        <div className="flex flex-wrap items-center gap-4">
          <ChefAvatar avatar={chef.avatar} size={150} uid="account-chef" title="Your chef" />
          <div className="flex flex-col items-start gap-2">
            {!!chef.clubs.length && (
              <ul className="flex flex-wrap gap-1.5">
                {chef.clubs.map((id) => (
                  <li key={id} className="rounded-full border border-line px-2.5 py-0.5 text-xs font-semibold">{CLUB_BY_ID[id].name}</li>
                ))}
              </ul>
            )}
            <Link href="/chef" className="btn btn-ghost btn-sm">
              {p.avatar ? "Edit my chef" : "Make my chef"}
            </Link>
          </div>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="label">Cook profile</span>
            <p className="flex items-center gap-3 font-display text-3xl font-bold">
              <LevelIcon index={game.level.index} size={48} />
              {game.level.name}
            </p>
            <p className="text-sm text-muted">
              <span className="tabular font-mono">{game.points}</span> points
              {game.level.next ? ` · ${game.level.toNext} to ${game.level.next}` : " · top level"} · {game.streak}-week streak
            </p>
          </div>
          <Link href="/leaderboard" className="btn btn-ghost btn-sm">
            Leaderboard
          </Link>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-sunk" role="progressbar" aria-label="Progress to next level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(game.level.progress * 100)}>
          <div className="h-full rounded-full bg-basil" style={{ width: `${Math.round(game.level.progress * 100)}%` }} />
        </div>
        <LevelLadder current={game.level.index} />
        <NameForm initial={p.public_name ?? ""} />
        <DietForm initial={p.diets ?? []} />
        <div className="flex flex-col gap-2">
          <span className="label">Badges</span>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(Object.keys(BADGES) as BadgeId[]).map((id) => (
              <li key={id} className={`flex items-start gap-3 rounded-2xl border p-3 ${earned.has(id) ? "border-saffron bg-saffron/10" : "border-line opacity-60"}`}>
                <BadgeIcon id={id} earned={earned.has(id)} size={36} />
                <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {BADGES[id].label}
                  {game.badges.filter((b) => b.badge === id).length > 1 ? ` ×${game.badges.filter((b) => b.badge === id).length}` : ""}
                </p>
                <p className="text-xs text-muted">{BADGES[id].blurb}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        {!!prizes?.length && (
          <div className="flex flex-col gap-2">
            <span className="label">Prizes</span>
            <ul className="flex flex-col gap-1 text-sm">
              {prizes.map((z) => (
                <li key={z.id}>
                  {z.detail} · {z.reason.replace("_", " ")} · <span className="text-muted">{z.status}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {p.is_admin && (
          <Link href="/admin" className="btn btn-sun w-fit">
            Open cook-off admin
          </Link>
        )}
      </section>

      <section className="card flex flex-col gap-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="label">Plan</span>
            <p className="font-display text-2xl font-bold">{me.plus ? "Plus" : "Free"}</p>
            <p className="text-sm text-muted">
              {paid && p.cancel_at ? `Ends ${fmtDate(p.cancel_at)}` : paid && p.current_period_end ? `Renews ${fmtDate(p.current_period_end)}` : null}
              {paid && p.subscription_status === "past_due" ? " · Payment failed, update your card" : null}
              {!paid && bonusUntil ? `Free Plus from referrals until ${bonusUntil}` : null}
            </p>
          </div>
          {p.stripe_customer_id && paid ? (
            <form action="/api/stripe/portal" method="post">
              <button className="btn btn-ghost">Manage billing</button>
            </form>
          ) : (
            <span className="flex flex-wrap gap-2">
              <form action="/api/stripe/checkout" method="post">
                <button className="btn btn-primary">Upgrade to Plus · {PLUS_MONTHLY}/mo</button>
              </form>
              {process.env.STRIPE_PRICE_PLUS_YEARLY && (
                <form action="/api/stripe/checkout" method="post">
                  <input type="hidden" name="interval" value="year" />
                  <button className="btn btn-ghost">{PLUS_YEARLY}/year</button>
                </form>
              )}
            </span>
          )}
        </div>
      </section>

      <section id="invite" className="card flex scroll-mt-20 flex-col gap-4 p-6">
        <div>
          <span className="label">Invite friends</span>
          <h2 className="font-display text-2xl font-bold">Earn a free month for every {stats.goal} friends who cook</h2>
          <p className="text-sm text-muted">Friends get a week of Plus when they sign up from your link. Recipe pages you share carry your code too. Up to {REFERRAL_MAX_REWARDS} free months in all.</p>
        </div>
        <CopyField value={link} label="Your invite link" />
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-sm">
            <span>Next free month</span>
            <span className="tabular font-mono">
              {stats.towardNext} / {stats.goal} cooks
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-sunk" role="progressbar" aria-valuemin={0} aria-valuemax={stats.goal} aria-valuenow={stats.towardNext}>
            <div className="h-full rounded-full bg-saffron" style={{ width: `${(stats.towardNext / stats.goal) * 100}%` }} />
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-3 text-center">
          {[
            ["Link opens", stats.visits],
            ["Sign-ups", stats.signups],
            ["Cooked", stats.cooks],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-sunk p-3">
              <dt className="label">{k}</dt>
              <dd className="tabular font-mono text-2xl font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="card flex flex-col gap-4 p-6">
        <div>
          <span className="label">Your data</span>
          <h2 className="font-display text-2xl font-bold">Download or delete</h2>
          <p className="text-sm text-muted">Get a copy of everything Yumjack stores about you, or delete your account for good.</p>
        </div>
        <a href="/api/account/export" className="btn btn-ghost btn-sm self-start" download>
          Download my data
        </a>
        <DeleteAccount plus={me.plus} />
      </section>
    </main>
  );
}
