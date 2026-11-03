"use client";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { submitDishGuess } from "@/app/games/actions";
import { celebrate, here } from "@/lib/celebrate";
import { DISH_MAX_GUESSES, dishShareText, dishView, sameDish } from "@/lib/games";
import type { DishState } from "@/lib/games-server";
import { ShareButton } from "@/components/ShareButton";

/**
 * Guess the Dish: a zoomed, blurred photo that sharpens with every wrong guess.
 * Guesses come from a fixed list (no spelling worries); the server checks each one.
 */
export function DishGuessGame({
  day,
  imageUrl,
  choices,
  initial,
  signedIn,
  streak,
  shareUrl,
}: {
  day: string;
  imageUrl: string;
  choices: string[];
  initial: DishState;
  signedIn: boolean;
  streak: number;
  shareUrl: string;
}) {
  const [state, setState] = useState<DishState>(initial);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const misses = state.results.filter((r) => !r).length;
  const view = dishView(misses, state.over);
  const guessed = (c: string) => state.guesses.some((g) => sameDish(g, c));
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return choices.filter((c) => !guessed(c) && (!q || c.toLowerCase().includes(q))).slice(0, q ? 12 : 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, choices, state.guesses]);

  function guess(pick: string) {
    setError(null);
    const at = here();
    start(async () => {
      const r = await submitDishGuess(day, pick, signedIn ? [] : state.guesses);
      if ("error" in r) return setError(r.error);
      setState(r);
      setQuery("");
      if (r.over && r.solved) celebrate({ text: r.points && signedIn ? `+${r.points} points` : "You got it!", origin: at, big: r.guesses.length <= 2 });
    });
  }

  return (
    <section className="card flex flex-col gap-5 p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <span className="label">
          {state.over ? (state.solved ? `Solved in ${state.guesses.length}` : "Out of guesses") : `Guess ${state.guesses.length + 1} of ${DISH_MAX_GUESSES}`}
        </span>
        <span className="flex gap-1" aria-label={`${state.guesses.length} guesses made`}>
          {Array.from({ length: DISH_MAX_GUESSES }, (_, i) => (
            <span
              key={i}
              className={`size-2.5 rounded-full ${i < state.results.length ? (state.results[i] ? "bg-basil" : "bg-chili") : "bg-line"}`}
            />
          ))}
        </span>
      </div>

      <div className="relative mx-auto aspect-square w-full max-w-md overflow-hidden rounded-3xl bg-sunk">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={state.over && state.reveal ? state.reveal.dish : "Today's mystery dish, zoomed in"}
          className="size-full object-cover transition-[transform,filter] duration-700 ease-out"
          style={{ transform: `scale(${view.scale})`, filter: view.blur ? `blur(${view.blur}px)` : undefined }}
          draggable={false}
        />
        {!state.over && (
          <span className="absolute left-3 top-3 rounded-full bg-ink/80 px-3 py-1 font-mono text-xs font-semibold text-bg">
            {misses === 0 ? "Zoomed in" : `Zoomed out ${misses}×`}
          </span>
        )}
      </div>

      {state.hints.length > 0 && !state.over && (
        <ul className="flex flex-wrap gap-2 text-sm" aria-label="Hints">
          {state.hints.map((h) => (
            <li key={h.name} className="rounded-full bg-saffron/15 px-3 py-1">
              <b>{h.name}:</b> {h.value}
            </li>
          ))}
        </ul>
      )}

      {state.guesses.length > 0 && (
        <ol className="flex flex-col gap-1.5" aria-label="Your guesses">
          {state.guesses.map((g, i) => (
            <li key={i} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${state.results[i] ? "bg-basil/15 font-semibold" : "bg-chili/10"}`}>
              <span aria-hidden>{state.results[i] ? "🟩" : "🟥"}</span>
              {g}
            </li>
          ))}
        </ol>
      )}

      {!state.over ? (
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1">
            <span className="label">What dish is it?</span>
            <input
              className="input"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Start typing: burrito, ramen, pancakes…"
              autoComplete="off"
              disabled={pending}
            />
          </label>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {matches.map((c) => (
              <li key={c}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => guess(c)}
                  className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-left text-sm font-medium hover:border-basil disabled:opacity-60"
                >
                  {c}
                </button>
              </li>
            ))}
            {matches.length === 0 && <li className="text-sm text-muted">No dishes match. Try another word.</li>}
          </ul>
          {pending && <p className="text-sm text-muted">Checking…</p>}
        </div>
      ) : (
        <div className="flex flex-col gap-3" aria-live="polite">
          {state.reveal && (
            <p className="text-lg">
              It was <b>{state.reveal.dish}</b>
              {state.reveal.label ? ` (${state.reveal.label})` : ""}.{" "}
              <Link href={`/r/${state.reveal.slug}`} className="font-semibold text-basil underline">
                Get the recipe
              </Link>
            </p>
          )}
          {signedIn ? (
            <p className="text-sm">
              {state.points > 0 ? <b>+{state.points} points.</b> : "No points today."}{" "}
              {streak > 1 ? `${streak} days in a row.` : "Come back tomorrow for a new dish."}
            </p>
          ) : (
            <p className="text-sm">
              <Link href="/login?next=/games/dish" className="font-semibold text-basil underline">
                Sign in
              </Link>{" "}
              to earn points and keep a streak. It&apos;s free.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <ShareButton text={dishShareText(day, state.results, shareUrl)} />
            <Link href="/games" className="btn btn-ghost">
              More games
            </Link>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-chili">
          {error}
        </p>
      )}
    </section>
  );
}
