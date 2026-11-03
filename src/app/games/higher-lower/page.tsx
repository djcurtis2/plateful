import type { Metadata } from "next";
import Link from "next/link";
import { getMe } from "@/lib/data";
import { gamePlay, hlCard, hlDeck, hlLeaders, hlReplay } from "@/lib/games-server";
import { HL_MAX_POINTS, HL_POINTS_EVERY, type HlGuess } from "@/lib/games";
import { menuPlate } from "@/lib/recipe";
import { publicName } from "@/lib/game";
import { triviaDay } from "@/lib/trivia";
import { siteUrl } from "@/lib/env";
import { HigherLowerGame } from "@/components/HigherLowerGame";

export const metadata: Metadata = {
  title: "Higher or Lower",
  description: "Does the next restaurant dish cost more or less per plate? A daily run, the same deck for everyone.",
};
export const dynamic = "force-dynamic";

export default async function HigherLowerPage() {
  const day = triviaDay();
  const [deck, me, leaders] = await Promise.all([hlDeck(day), getMe(), hlLeaders(day)]);
  const play = me && deck ? await gamePlay(me.user.id, "higher_lower", day) : null;
  const state = deck ? hlReplay(deck, (play?.picks ?? []) as HlGuess[]) : null;

  const initial =
    deck && state
      ? {
          current: { ...hlCard(deck[state.index]), price: menuPlate(deck[state.index])! },
          next: state.over ? null : hlCard(deck[state.index + 1]),
          score: state.score,
          over: state.over,
          perfect: state.perfect,
        }
      : null;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 pt-8">
      <div>
        <Link href="/games" className="label hover:underline">
          ← Daily games
        </Link>
        <h1 className="font-display text-4xl font-bold tracking-tight">Higher or Lower</h1>
        <p className="text-muted">
          Does the next restaurant dish cost more or less per plate? Keep going until you miss. Same deck for everyone today. 1 point every {HL_POINTS_EVERY}{" "}
          in a row, up to {HL_MAX_POINTS}.
        </p>
      </div>

      {initial ? (
        <HigherLowerGame day={day} signedIn={!!me} initial={initial} shareUrl={`${siteUrl}/games/higher-lower`} />
      ) : (
        <p className="card p-6 text-muted">Today&apos;s deck isn&apos;t ready yet. It needs a few more restaurant copycats. Check back soon.</p>
      )}

      {leaders.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-xl font-bold">Today&apos;s best runs</h2>
          <ol className="card divide-y divide-line">
            {leaders.map((r) => (
              <li key={r.userId} className={`flex items-center justify-between gap-3 px-4 py-2.5 ${me?.user.id === r.userId ? "bg-sunk" : ""}`}>
                <span className="flex min-w-0 items-center gap-3">
                  <span className="tabular w-6 font-mono text-sm text-muted">#{r.rank}</span>
                  <span className="truncate font-semibold">{publicName(r.name)}</span>
                </span>
                <span className="tabular font-mono">🔥 {r.score}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </main>
  );
}
