import type { Metadata } from "next";
import Link from "next/link";
import { getMe } from "@/lib/data";
import { gamePlay, gameStreak } from "@/lib/games-server";
import { triviaPlay } from "@/lib/trivia-server";
import { triviaDay } from "@/lib/trivia";

export const metadata: Metadata = {
  title: "Daily games",
  description: "Quick daily food games: trivia, Guess the Dish, Higher or Lower and a weekly Cooking Bingo card.",
};
export const dynamic = "force-dynamic";

type Tile = { href: string; title: string; blurb: string; when: string; status: string | null; icon: string };

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
      icon: "🔍",
      title: "Guess the Dish",
      blurb: "A zoomed-in, blurry dish photo that sharpens with every guess. Six tries.",
      when: "Daily",
      status: dish?.finished_at ? (dish.solved ? `Solved in ${dish.picks.length} ✓` : "Played today ✓") : dishStreak > 1 ? `${dishStreak}-day streak` : null,
    },
    {
      href: "/games/higher-lower",
      icon: "↕️",
      title: "Higher or Lower",
      blurb: "Is the next restaurant dish more or less per plate? Keep going until you miss.",
      when: "Daily",
      status: hl?.finished_at ? `🔥 ${hl.score} in a row ✓` : null,
    },
    {
      href: "/trivia",
      icon: "❓",
      title: "Daily trivia",
      blurb: "Three cooking questions, with a kitchen trick in every answer.",
      when: "Daily",
      status: trivia?.finished_at ? `${trivia.correct}/3 today ✓` : null,
    },
    {
      href: "/games/bingo",
      icon: "🎯",
      title: "Cooking Bingo",
      blurb: "A weekly card of things to cook and try. Squares tick themselves as you cook.",
      when: "Weekly",
      status: null,
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
            <Link href={t.href} className="card group flex h-full flex-col gap-2 p-5 hover:border-basil">
              <span className="flex items-center justify-between gap-2">
                <span className="text-3xl" aria-hidden>
                  {t.icon}
                </span>
                <span className="label">{t.when}</span>
              </span>
              <span className="font-display text-2xl font-bold group-hover:text-basil">{t.title}</span>
              <span className="text-sm text-muted">{t.blurb}</span>
              <span className="mt-auto pt-2 text-sm font-semibold text-basil">{t.status ?? "Play →"}</span>
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
