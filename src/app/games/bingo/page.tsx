import type { Metadata } from "next";
import Link from "next/link";
import { getMe } from "@/lib/data";
import { bingoFor } from "@/lib/games-server";
import { myChef } from "@/lib/avatar-server";
import { BINGO_FREE, BINGO_FULL_POINTS, BINGO_LINE_POINTS, BINGO_LINES, bingoShareText, weekStart } from "@/lib/games";
import { GEAR, lockReason, visibleAvatar, type Avatar } from "@/lib/avatar";
import { addDays, triviaDay } from "@/lib/trivia";
import { siteUrl } from "@/lib/env";
import { BingoBoard, type BingoCell } from "@/components/BingoBoard";
import { ChefAvatar } from "@/components/ChefAvatar";

export const metadata: Metadata = {
  title: "Cooking Bingo",
  description: "A weekly bingo card of things to cook and try. Squares tick themselves as you cook.",
};
export const dynamic = "force-dynamic";

const BINGO_GEAR = GEAR.filter((g) => g.source.kind === "bingo");

function weekLabel(week: string) {
  const f = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return `${f(week)} – ${f(addDays(week, 6))}`;
}

export default async function BingoPage() {
  const today = triviaDay();
  const week = weekStart(today);
  const me = await getMe();
  const { card, marks, lines, earned, activity } = await bingoFor(me?.user.id ?? null, week);
  // After bingoFor, so lines it just awarded already count toward the rewards.
  const chef = me ? await myChef(me.user.id) : null;
  const inLine = new Set<number>(lines.flatMap((i) => [...BINGO_LINES[i]]));
  const full = marks.every(Boolean);
  const daysLeft = 7 - Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${week}T00:00:00Z`)) / 86_400_000);

  const cells: BingoCell[] = card.map((sq, i) =>
    sq === BINGO_FREE
      ? { label: "Free", how: "", href: "", free: true, done: true, inLine: inLine.has(i), progress: null }
      : {
          label: sq.label,
          how: sq.how,
          href: sq.href,
          free: false,
          done: marks[i],
          inLine: inLine.has(i),
          progress: activity && sq.progress ? sq.progress(activity) : null,
        },
  );

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 pt-8">
      <div>
        <Link href="/games" className="label hover:underline">
          ← Daily games
        </Link>
        <h1 className="font-display text-4xl font-bold tracking-tight">Cooking Bingo</h1>
        <p className="text-muted">
          A new card every Monday, the same for everyone. Squares tick themselves as you cook and play on Yumjack. {BINGO_LINE_POINTS} points per line,{" "}
          {BINGO_FULL_POINTS} more for the full card. Tap a square to see how to get it.
        </p>
      </div>

      <section className="card flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="label">Week of {weekLabel(week)}</span>
          <span className="text-sm text-muted">
            {daysLeft} {daysLeft === 1 ? "day" : "days"} left
          </span>
        </div>
        <BingoBoard
          week={week}
          cells={cells}
          signedIn={!!me}
          lines={lines.length}
          full={full}
          earned={earned}
          shareText={bingoShareText(week, marks, `${siteUrl}/games/bingo`)}
          pointsPerLine={BINGO_LINE_POINTS}
          fullPoints={BINGO_FULL_POINTS}
        />
      </section>

      <section className="card flex flex-col gap-4 p-5 sm:p-6">
        <div>
          <h2 className="font-display text-xl font-bold">Bingo rewards</h2>
          <p className="text-sm text-muted">
            Lines add up across weeks and unlock gear for your chef.
            {chef && ` So far: ${chef.ctx.bingo.lines} ${chef.ctx.bingo.lines === 1 ? "line" : "lines"}, ${chef.ctx.bingo.full} full ${chef.ctx.bingo.full === 1 ? "card" : "cards"}.`}
          </p>
        </div>
        <ul className="grid grid-cols-3 gap-2 sm:gap-3">
          {BINGO_GEAR.map((g) => {
            const got = !!chef?.unlocked.has(g.id);
            const base: Avatar | null = chef ? visibleAvatar(chef.avatar, chef.ctx.plus) : null;
            return (
              <li key={g.id} className={`flex flex-col items-center gap-1 rounded-2xl border p-2 text-center ${got ? "border-basil bg-basil/10" : "border-line"}`}>
                {base ? (
                  <span className={got ? "" : "opacity-60"}>
                    <ChefAvatar avatar={{ ...base, equipped: { ...base.equipped, [g.slot]: g.id } }} size={110} uid={`bingo-${g.id}`} title={`Your chef with ${g.name}`} />
                  </span>
                ) : (
                  <span className="flex h-[110px] items-center text-3xl" aria-hidden>
                    🎁
                  </span>
                )}
                <span className="text-sm font-semibold leading-tight">{g.name}</span>
                <span className={`text-xs ${got ? "font-semibold text-basil" : "text-muted"}`}>{got ? "Unlocked" : lockReason(g)}</span>
              </li>
            );
          })}
        </ul>
        {chef && BINGO_GEAR.some((g) => chef.unlocked.has(g.id)) && (
          <Link href="/chef?tab=wardrobe" className="btn btn-ghost btn-sm w-fit">
            Dress my chef
          </Link>
        )}
      </section>

      <p className="text-xs text-muted">
        Squares count what you do this week (Monday to Sunday, UTC). Cooking counts when you tap &ldquo;I made it,&rdquo; tick a planned dinner, or post a cook-off
        entry. <Link href="/rules" className="underline">Rules</Link>
      </p>
    </main>
  );
}
