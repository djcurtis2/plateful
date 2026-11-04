import type { Metadata } from "next";
import Link from "next/link";
import { getMe } from "@/lib/data";
import { bingoFor } from "@/lib/games-server";
import { BINGO_FREE, BINGO_FULL_POINTS, BINGO_LINE_POINTS, BINGO_LINES, bingoShareText, weekStart } from "@/lib/games";
import { addDays, triviaDay } from "@/lib/trivia";
import { siteUrl } from "@/lib/env";
import { ShareButton } from "@/components/ShareButton";

export const metadata: Metadata = {
  title: "Cooking Bingo",
  description: "A weekly bingo card of things to cook and try. Squares tick themselves as you cook.",
};
export const dynamic = "force-dynamic";

function weekLabel(week: string) {
  const f = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return `${f(week)} – ${f(addDays(week, 6))}`;
}

export default async function BingoPage() {
  const today = triviaDay();
  const week = weekStart(today);
  const me = await getMe();
  const { card, marks, lines, earned } = await bingoFor(me?.user.id ?? null, week);
  const inLine = new Set<number>(lines.flatMap((i) => [...BINGO_LINES[i]]));
  const full = marks.every(Boolean);
  const daysLeft = 7 - Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${week}T00:00:00Z`)) / 86_400_000);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 pt-8">
      <div>
        <Link href="/games" className="label hover:underline">
          ← Daily games
        </Link>
        <h1 className="font-display text-4xl font-bold tracking-tight">Cooking Bingo</h1>
        <p className="text-muted">
          A new card every Monday, the same for everyone. Squares tick themselves as you cook and play on Yumjack. {BINGO_LINE_POINTS} points per line,{" "}
          {BINGO_FULL_POINTS} more for the full card.
        </p>
      </div>

      <section className="card flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="label">Week of {weekLabel(week)}</span>
          <span className="text-sm text-muted">
            {daysLeft} {daysLeft === 1 ? "day" : "days"} left
          </span>
        </div>
        <ol className="grid grid-cols-3 gap-2 sm:gap-3">
          {card.map((sq, i) => {
            const done = marks[i];
            const free = sq === BINGO_FREE;
            const tone = free
              ? "bg-saffron text-saffron-ink"
              : done
                ? `bg-basil text-basil-ink ${inLine.has(i) ? "ring-4 ring-saffron" : ""}`
                : "bg-sunk text-ink hover:ring-2 hover:ring-basil";
            const body = (
              <>
                <span className="text-lg" aria-hidden>
                  {free ? "⭐" : done ? "✓" : ""}
                </span>
                <span className="text-xs font-semibold leading-tight sm:text-sm">{free ? "Free" : sq.label}</span>
              </>
            );
            const cls = `flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl p-2 text-center transition-shadow ${tone}`;
            return (
              <li key={i}>
                {free || done || !me ? (
                  <div className={cls} aria-label={free ? "Free square" : `${sq.label}${done ? ", done" : ""}`}>
                    {body}
                  </div>
                ) : (
                  <Link href={sq.href} className={cls}>
                    {body}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>

        {me ? (
          <div className="flex flex-col gap-3" aria-live="polite">
            <p>
              {full ? (
                <b>Full card! </b>
              ) : (
                <>
                  <b>
                    {lines.length} {lines.length === 1 ? "line" : "lines"}
                  </b>{" "}
                  so far.{" "}
                </>
              )}
              {earned > 0 ? `+${earned} points this week.` : "Finish a row, column or diagonal for points. Tap a square to get started."}
            </p>
            <div className="flex flex-wrap gap-2">
              <ShareButton text={bingoShareText(week, marks, `${siteUrl}/games/bingo`)} label="Share my card" />
              <Link href="/games" className="btn btn-ghost">
                More games
              </Link>
            </div>
          </div>
        ) : (
          <p>
            <Link href="/login?next=/games/bingo" className="font-semibold text-basil underline">
              Sign in
            </Link>{" "}
            to get your own card. Squares tick themselves as you cook, so there&apos;s nothing to fill in.
          </p>
        )}
      </section>

      <p className="text-xs text-muted">
        Squares count what you do this week (Monday to Sunday, UTC). Cooking counts when you tap &ldquo;I made it,&rdquo; tick a planned dinner, or post a cook-off
        entry. <Link href="/rules" className="underline">Rules</Link>
      </p>
    </main>
  );
}
