import type { Metadata } from "next";
import Link from "next/link";
import { getMe } from "@/lib/data";
import { dishOfDay, dishState, gamePlay, gameStreak } from "@/lib/games-server";
import { DISH_MAX_GUESSES } from "@/lib/games";
import { triviaDay } from "@/lib/trivia";
import { siteUrl } from "@/lib/env";
import { DishGuessGame } from "@/components/DishGuessGame";

export const metadata: Metadata = {
  title: "Guess the Dish",
  description: "A daily food puzzle: a zoomed-in dish photo that gets clearer with every guess. Six tries.",
};
export const dynamic = "force-dynamic";

export default async function GuessDishPage() {
  const day = triviaDay();
  const [today, me] = await Promise.all([dishOfDay(day), getMe()]);
  const [play, streak] = me && today ? await Promise.all([gamePlay(me.user.id, "guess_dish", day), gameStreak(me.user.id, "guess_dish", day)]) : [null, 0];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 pt-8">
      <div>
        <Link href="/games" className="label hover:underline">
          ← Daily games
        </Link>
        <h1 className="font-display text-4xl font-bold tracking-tight">Guess the Dish</h1>
        <p className="text-muted">
          One mystery dish a day, the same for everyone. Every wrong guess zooms out and sharpens the photo, and hints unlock as you go. {DISH_MAX_GUESSES}{" "}
          tries. Up to 3 points.
        </p>
      </div>
      {today ? (
        <DishGuessGame
          day={day}
          imageUrl={`/api/games/dish-image?day=${day}`}
          choices={today.choices}
          initial={dishState(today.recipe, play?.picks ?? [])}
          signedIn={!!me}
          streak={streak}
          shareUrl={`${siteUrl}/games/dish`}
        />
      ) : (
        <p className="card p-6 text-muted">Today&apos;s dish isn&apos;t ready yet. It needs a few recipes with photos. Check back soon.</p>
      )}
    </main>
  );
}
