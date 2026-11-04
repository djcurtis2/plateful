import type { Metadata } from "next";
import Link from "next/link";
import { getMe } from "@/lib/data";
import { gamePlay, gameStreak } from "@/lib/games-server";
import { triviaPlay } from "@/lib/trivia-server";
import { TRIVIA_PER_DAY, TRIVIA_STREAK_BONUS, TRIVIA_STREAK_EVERY, triviaDay } from "@/lib/trivia";
import { POINTS } from "@/lib/game";
import { BINGO_FULL_POINTS, BINGO_LINE_POINTS, DISH_MAX_POINTS, HL_MAX_POINTS } from "@/lib/games";
import { GameArt, type GameArtKind } from "@/components/GameArt";

export const metadata: Metadata = {
  title: "Daily games",
  description: "Quick daily food games: trivia, Guess the Dish, Higher or Lower and a weekly Cooking Bingo card.",
};
export const dynamic = "force-dynamic";

type Tile = {
  href: string;
  art: GameArtKind;
  color: string;
  title: string;
  blurb: string;
  reward: string;
  done: string | null;
  streak?: string | null;
  cta: string;
};

const tileText = "text-[color-mix(in_oklab,var(--tile)_55%,var(--ink))]";
const pill = `w-fit rounded-full bg-[color-mix(in_oklab,var(--tile)_20%,var(--surface))] px-2.5 py-0.5 text-xs font-semibold ${tileText}`;

export default async function GamesPage() {
  const day = triviaDay();
  const me = await getMe();
  const [trivia, dish, hl, dishStreak] = me
    ? await Promise.all([
        triviaPlay(me.user.id, day),
        gamePlay(me.user.id, "guess_dish", day),
        gamePlay(me.user.id, "higher_lower", day),
        gameStreak(me.user.id, "guess_dish", day),
      ])
    : [null, null, null, 0];

  const tiles: Tile[] = [
    {
      href: "/games/dish",
      art: "dish",
      color: "var(--chili)",
      title: "Guess the Dish",
      blurb: "A zoomed-in, blurry dish photo that sharpens with every guess. Six tries.",
      reward: `Up to ${DISH_MAX_POINTS} pts a day`,
      done: dish?.finished_at ? (dish.solved ? `Solved in ${dish.picks.length}` : "Played today") : null,
      streak: dishStreak > 1 ? `${dishStreak}-day streak` : null,
      cta: "Play today",
    },
    {
      href: "/games/higher-lower",
      art: "higher-lower",
      color: "var(--basil)",
      title: "Higher or Lower",
      blurb: "Is the next restaurant dish more or less per plate? Keep going until you miss.",
      reward: `Up to ${HL_MAX_POINTS} pts a day`,
      done: hl?.finished_at ? `${hl.score} in a row` : null,
      cta: "Play today",
    },
    {
      href: "/trivia",
      art: "trivia",
      color: "var(--saffron)",
      title: "Daily trivia",
      blurb: "Three cooking questions, with a kitchen trick in every answer.",
      reward: `${TRIVIA_PER_DAY * POINTS.trivia} pts a day, +${TRIVIA_STREAK_BONUS} every ${TRIVIA_STREAK_EVERY}th day`,
      done: trivia?.finished_at ? `${trivia.correct}/${TRIVIA_PER_DAY} today` : null,
      cta: "Play today",
    },
    {
      href: "/games/bingo",
      art: "bingo",
      color: "var(--plum)",
      title: "Cooking Bingo",
      blurb: "A weekly card of things to cook and try. Squares tick themselves as you cook.",
      reward: `${BINGO_LINE_POINTS} pts a line, ${BINGO_FULL_POINTS} for a full card`,
      done: null,
      cta: "See this week's card",
    },
  ];

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 pt-8">
      <div>
        <span className="label">Daily games</span>
        <h1 className="font-display text-4xl font-bold tracking-tight">A few minutes a day, a little smarter in the kitchen</h1>
        <p className="text-muted">New puzzles every day, the same for everyone. Play as a guest, or sign in to earn points, keep streaks and climb the leaderboard.</p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2">
        {tiles.map((t) => (
          <li key={t.href}>
            <Link href={t.href} className="game-tile group flex h-full flex-col" style={{ "--tile": t.color } as React.CSSProperties}>
              <span className="game-scene relative block h-32">
                <GameArt kind={t.art} />
                {t.done && (
                  <span className="absolute right-3 top-3 grid size-8 place-items-center rounded-full bg-white text-sm font-bold text-[#1b2a22] shadow-sm" aria-hidden>
                    ✓
                  </span>
                )}
              </span>
              <span className="flex flex-1 flex-col gap-1.5 p-5">
                <span className="font-display text-2xl font-bold">{t.title}</span>
                <span className="text-sm text-muted">{t.blurb}</span>
                <span className="flex flex-wrap gap-1.5 pt-1">
                  <span className={pill}>★ {t.reward}</span>
                  {t.streak && <span className={pill}>🔥 {t.streak}</span>}
                </span>
                <span className={`mt-auto pt-3 text-sm font-semibold ${tileText}`}>
                  {t.done ? (
                    `✓ ${t.done}`
                  ) : (
                    <>
                      {t.cta} <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
                    </>
                  )}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">
        Game points count toward your level and chef gear, not the monthly cook-off prize. Nothing here is ever bought or left to chance.{" "}
        <Link href="/rules" className="underline">
          Rules
        </Link>
      </p>
    </main>
  );
}
