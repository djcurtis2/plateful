import { Snapper } from "@/components/Snapper";
import { RecipeTile } from "@/components/RecipeTile";
import { WaitlistForm } from "@/components/WaitlistForm";
import { getCurrentChallenge, getMe, getRecentPublicRecipes, isLive } from "@/lib/data";
import { siteSavings } from "@/lib/savings-server";
import { publicName, timeLeft } from "@/lib/game";
import { leaderboard } from "@/lib/game-server";
import { ChefAvatar } from "@/components/ChefAvatar";
import { ClubBadge } from "@/components/ClubBadge";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [me, recent, challenge, community] = await Promise.all([
    getMe().catch(() => null),
    getRecentPublicRecipes(6).catch(() => []),
    getCurrentChallenge().catch(() => null),
    siteSavings(),
  ]);
  // Top chefs strip: this cook-off's points, or all-time when there's no cook-off. Hidden until 3 people have points,
  // so an empty site never shows a lonely podium.
  const top = (await leaderboard(challenge ? { challengeId: challenge.id } : "all", 3).catch(() => [])).filter((r) => r.points > 0);

  return (
    <main className="flex flex-col gap-16 pt-8 sm:pt-12">
      <section className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)]">
        <div className="flex min-w-0 flex-col gap-6">
          <span className="label">Restaurant copycats</span>
          <h1 className="font-display text-5xl font-bold leading-[1.02] tracking-tight sm:text-6xl">
            Snap the restaurant plate. <span className="text-basil">Make it for less.</span>
          </h1>
          <p className="max-w-[58ch] text-lg text-muted">
            Upload a photo of a dish you ate out. Dupe Kitchen identifies it, writes a copycat recipe for your table, shows what you
            save per plate, and builds the grocery list. Then post your version next to the original.
          </p>
          <ol className="grid max-w-xl grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Snap", "Photo of the dish"],
              ["Recipe", "Scaled to your table"],
              ["Shop", "Instacart, Walmart, Kroger"],
              ["Share", "Restaurant vs. mine"],
            ].map(([t, d]) => (
              <li key={t} className="border-t-2 border-basil pt-2 text-sm">
                <b className="block font-display text-base">{t}</b>
                <span className="text-muted">{d}</span>
              </li>
            ))}
          </ol>
          {community.saved >= 1 && (
            <p className="w-fit rounded-2xl border border-saffron bg-saffron/10 px-4 py-3">
              Dupe Kitchen cooks have saved{" "}
              <b className="tabular font-mono text-lg text-basil">${Math.round(community.saved).toLocaleString("en-US")}</b> cooking{" "}
              {community.meals.toLocaleString("en-US")} {community.meals === 1 ? "meal" : "meals"} at home instead of eating out.
            </p>
          )}
        </div>
        <Snapper signedIn={!!me} />
      </section>

      {challenge && (
        <section className="card flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="label">{isLive(challenge) ? `This week's cook-off · ${timeLeft(challenge.ends_at)}` : "Cook-off results"}</span>
            <h2 className="font-display text-3xl font-bold tracking-tight">{challenge.title}</h2>
            {challenge.blurb && <p className="text-muted">{challenge.blurb}</p>}
          </div>
          <Link href="/cookoff" className="btn btn-sun shrink-0">
            {isLive(challenge) ? "Join the cook-off" : "See the winners"}
          </Link>
        </section>
      )}

      {top.length >= 3 && (
        <section className="flex flex-col gap-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <span className="label">{challenge ? "This cook-off" : "All time"}</span>
              <h2 className="font-display text-3xl font-bold tracking-tight">Top chefs</h2>
            </div>
            <Link href="/leaderboard" className="text-sm font-semibold text-basil hover:underline">
              Full leaderboard
            </Link>
          </div>
          <ol className="grid gap-4 sm:grid-cols-3">
            {top.map((r) => (
              <li key={r.userId} className="card flex flex-col items-center gap-2 p-5 text-center">
                <span className={`tabular font-mono text-sm font-semibold ${r.rank === 1 ? "text-basil" : "text-muted"}`}>#{r.rank}</span>
                <ChefAvatar avatar={r.chef.avatar} size={112} uid={`${r.userId}-home`} title={`${publicName(r.name)}'s chef`} />
                <span className="w-full truncate font-semibold">{publicName(r.name)}</span>
                <span className="text-xs text-muted">
                  {r.level} · <span className="tabular font-mono">{r.points}</span> pts
                </span>
                {r.chef.clubs.length > 0 && (
                  <span className="flex flex-wrap justify-center gap-1.5">
                    {r.chef.clubs.slice(0, 2).map((c) => (
                      <ClubBadge key={c} id={c} />
                    ))}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      {recent.length > 0 && (
        <section className="flex flex-col gap-5">
          <div className="flex items-end justify-between gap-4">
            <h2 className="font-display text-3xl font-bold tracking-tight">Fresh copycats</h2>
            <span className="text-sm text-muted">Made by Dupe Kitchen cooks</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((r) => (
              <RecipeTile key={r.id} recipe={r} />
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-6 rounded-3xl bg-basil p-6 text-basil-ink sm:p-10 lg:grid-cols-2 lg:items-center">
        <div>
          <h2 className="font-display text-3xl font-bold tracking-tight">One copycat a week, in your inbox</h2>
          <p className="mt-2 opacity-85">The week&apos;s cook-off dish, the price gap, and the best attempts from the community.</p>
        </div>
        <WaitlistForm />
      </section>
    </main>
  );
}
