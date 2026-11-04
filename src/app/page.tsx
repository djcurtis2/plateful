import { Snapper } from "@/components/Snapper";
import { RecipeTile } from "@/components/RecipeTile";
import { WaitlistForm } from "@/components/WaitlistForm";
import { getCurrentChallenge, getMe, getRecentPublicRecipes, isLive } from "@/lib/data";
import { siteSavings } from "@/lib/savings-server";
import { publicName, timeLeft } from "@/lib/game";
import { leaderboard } from "@/lib/game-server";
import { triviaPlay, triviaQuestions } from "@/lib/trivia-server";
import { TRIVIA_PER_DAY, triviaDay } from "@/lib/trivia";
import { BINGO_FULL_POINTS, BINGO_LINE_POINTS, DISH_MAX_POINTS, HL_MAX_POINTS } from "@/lib/games";
import { ChefAvatar } from "@/components/ChefAvatar";
import { ClubBadge } from "@/components/ClubBadge";
import Link from "next/link";
import Image from "next/image";
import { menuPlate, savings } from "@/lib/recipe";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

/** The site-wide savings line stays hidden until the number helps rather than hurts. */
const SHOW_SAVINGS_FROM = 1000;

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
  // Daily trivia teaser: today's first question (never the answers), once the day's set is approved.
  const today = triviaDay();
  const trivia = await triviaQuestions(today).catch(() => []);
  const triviaDone = me && trivia.length === TRIVIA_PER_DAY ? !!(await triviaPlay(me.user.id, today).catch(() => null))?.finished_at : false;

  // The proof near the top: the recent copycat with a photo that saves the most per plate.
  const proof = recent
    .filter((r) => r.image_url && savings(r))
    .sort((a, b) => savings(b)!.saved - savings(a)!.saved)[0];
  const proofPct = proof ? savings(proof)!.pct : 0;

  return (
    <main className="flex flex-col gap-16 pt-8 sm:pt-12">
      {/* Phones read top to bottom: headline, snap box, proof. Wide screens put the snap box in its own column. */}
      <section className="grid items-start gap-x-10 gap-y-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] lg:grid-rows-[auto_1fr]">
        <div className="flex min-w-0 flex-col gap-4">
          <h1 className="font-display text-5xl font-bold leading-[1.02] tracking-tight sm:text-6xl">
            Snap the restaurant plate. <span className="text-basil">Make it for less.</span>
          </h1>
          <p className="max-w-[58ch] text-lg text-muted">Get the copycat recipe, the cost per plate and your grocery list from one photo.</p>
        </div>
        <div className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <Snapper signedIn={!!me} />
        </div>
        <div className="flex min-w-0 flex-col gap-6 lg:col-start-1 lg:row-start-2">
          {proof && (
            <Link href={`/r/${proof.slug}`} className="card group flex max-w-xl items-center gap-4 p-3 hover:border-basil">
              <span className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-sunk">
                <Image src={proof.image_url!} alt="" fill sizes="80px" className="object-cover" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate font-display font-bold group-hover:text-basil">{proof.dish}</span>
                <span className="tabular flex flex-wrap items-baseline gap-x-4 font-mono text-sm">
                  <span className="text-muted">
                    Restaurant <s>{money(menuPlate(proof)!)}</s>
                  </span>
                  <span>
                    Yours <b className="text-lg text-basil">{money(proof.plate_cost!)}</b>
                  </span>
                </span>
                <span className="text-xs text-muted">Estimated per plate, about {proofPct}% less.</span>
              </span>
            </Link>
          )}
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
          {community.saved >= SHOW_SAVINGS_FROM && (
            <p className="w-fit rounded-2xl border border-saffron bg-saffron/10 px-4 py-3">
              Yumjack cooks have saved{" "}
              <b className="tabular font-mono text-lg text-basil">${Math.round(community.saved).toLocaleString("en-US")}</b> cooking{" "}
              {community.meals.toLocaleString("en-US")} {community.meals === 1 ? "meal" : "meals"} at home instead of eating out.
            </p>
          )}
        </div>
      </section>

      {recent.length > 0 && (
        <section className="flex flex-col gap-5">
          <div className="flex items-end justify-between gap-4">
            <h2 className="font-display text-3xl font-bold tracking-tight">Fresh copycats</h2>
            <span className="text-sm text-muted">Made by Yumjack cooks</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 max-sm:[&>*:nth-child(n+4)]:hidden">
            {recent.map((r) => (
              <RecipeTile key={r.id} recipe={r} />
            ))}
          </div>
        </section>
      )}

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

      {trivia.length === TRIVIA_PER_DAY && (
        <section className="relative flex flex-col gap-4 overflow-hidden rounded-3xl bg-saffron p-6 text-saffron-ink sm:flex-row sm:items-center sm:justify-between sm:p-8">
          {/* Big faded question marks for a game-show feel; decoration only. */}
          <span aria-hidden className="pointer-events-none absolute -right-4 -top-10 select-none font-display text-[10rem] font-bold leading-none opacity-15">
            ?
          </span>
          <span aria-hidden className="pointer-events-none absolute -bottom-12 right-28 hidden select-none font-display text-[7rem] font-bold leading-none opacity-10 sm:block">
            ?
          </span>
          <div className="relative flex flex-col gap-1">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] opacity-80">
              Daily trivia · 3 questions{triviaDone ? " · done today ✓" : ""}
            </span>
            <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{trivia[0].question}</h2>
            <p className="opacity-80">A kitchen trick with every answer, and points for your chef.</p>
          </div>
          <Link
            href="/trivia"
            className={`btn relative shrink-0 ${triviaDone ? "border-2 border-saffron-ink/40 hover:border-saffron-ink" : "bg-saffron-ink text-saffron hover:opacity-90"}`}
          >
            {triviaDone ? "See today's answers" : "Play today's trivia →"}
          </Link>
        </section>
      )}

      <section aria-labelledby="home-games" className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-4">
          <h2 id="home-games" className="font-display text-2xl font-bold tracking-tight">
            More daily games
          </h2>
          <Link href="/games" className="text-sm font-semibold text-basil hover:underline">
            All games
          </Link>
        </div>
        <ul className="grid gap-3 sm:grid-cols-3">
          {[
            { href: "/games/dish", icon: "🔍", art: "?", tile: "var(--chili)", reward: `Up to ${DISH_MAX_POINTS} pts a day`, cta: "Play today", title: "Guess the Dish", blurb: "A blurry photo that sharpens with every guess." },
            { href: "/games/higher-lower", icon: "↕️", art: "⇅", tile: "var(--basil)", reward: `Up to ${HL_MAX_POINTS} pts a day`, cta: "Play today", title: "Higher or Lower", blurb: "Which restaurant dish costs more per plate?" },
            { href: "/games/bingo", icon: "🎯", art: "#", tile: "var(--plum)", reward: `${BINGO_LINE_POINTS} pts a line · ${BINGO_FULL_POINTS} for a full card`, cta: "See this week's card", title: "Cooking Bingo", blurb: "This week's card ticks itself as you cook." },
          ].map((g) => (
            <li key={g.href}>
              <Link href={g.href} className="game-tile group flex h-full items-start gap-3 p-4" style={{ "--tile": g.tile } as React.CSSProperties}>
                {/* Big faded symbol in the corner, like the trivia card's question marks; decoration only. */}
                <span
                  aria-hidden
                  className="game-tile-art pointer-events-none absolute -bottom-9 -right-3 select-none font-display text-[6rem] font-bold leading-none text-[var(--tile)] opacity-15"
                >
                  {g.art}
                </span>
                <span className="game-tile-icon relative grid size-11 shrink-0 place-items-center rounded-2xl text-2xl shadow-sm" aria-hidden>
                  {g.icon}
                </span>
                <span className="relative flex flex-col gap-0.5">
                  <span className="font-display text-lg font-bold text-[color-mix(in_oklab,var(--tile)_65%,var(--ink))]">{g.title}</span>
                  <span className="mb-1 w-fit rounded-full bg-[var(--tile)] px-2 py-0.5 font-mono text-[11px] font-semibold text-surface">★ {g.reward}</span>
                  <span className="text-sm text-muted">{g.blurb}</span>
                  <span className="mt-1 text-sm font-semibold text-[color-mix(in_oklab,var(--tile)_65%,var(--ink))]">
                    {g.cta} <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

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

      <Link
        href="/build"
        className="game-tile group flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between"
        style={{ "--tile": "var(--basil)" } as React.CSSProperties}
      >
        <span aria-hidden className="game-tile-art pointer-events-none absolute -bottom-10 right-6 select-none text-[6rem] leading-none opacity-20">
          🍽️
        </span>
        <span className="relative flex flex-col gap-1">
          <span className="label">New · Build a plate</span>
          <span className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Got chicken? Salmon? Tofu? Start there.</span>
          <span className="text-muted">Pick a protein, how to cook it and a flavor. We suggest the sides and write the recipe.</span>
        </span>
        <span className="btn btn-primary relative shrink-0">
          Build my plate <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
        </span>
      </Link>

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
