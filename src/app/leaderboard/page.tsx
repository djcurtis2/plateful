import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentChallenge, getMe, isLive } from "@/lib/data";
import { leaderboard } from "@/lib/game-server";
import { POINTS, publicName, streakBonus } from "@/lib/game";
import { BadgeIcon, LevelIcon, LevelLadder } from "@/components/GameIcons";

export const metadata: Metadata = { title: "Leaderboard" };
export const dynamic = "force-dynamic";

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const view = (await searchParams).view === "all" ? "all" : "week";
  const [challenge, me] = await Promise.all([getCurrentChallenge(), getMe()]);
  const weekId = challenge && isLive(challenge) ? challenge.id : challenge?.id ?? null;
  const rows = view === "all" ? await leaderboard("all", 50) : weekId ? await leaderboard({ challengeId: weekId }, 50) : [];

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 pt-8">
      <div>
        <span className="label">Cook-off</span>
        <h1 className="font-display text-4xl font-bold tracking-tight">Leaderboard</h1>
        <p className="text-muted">Points come from cooking, voting, collecting votes and bringing friends.</p>
      </div>

      <div role="group" aria-label="Leaderboard period" className="grid w-fit grid-cols-2 gap-1 rounded-xl bg-sunk p-1 text-sm">
        {[
          { k: "week", label: challenge ? "This cook-off" : "This week" },
          { k: "all", label: "All time" },
        ].map((t) => (
          <Link
            key={t.k}
            href={t.k === "all" ? "/leaderboard?view=all" : "/leaderboard"}
            aria-current={view === t.k ? "page" : undefined}
            className={`rounded-lg px-4 py-1.5 font-semibold ${view === t.k ? "bg-surface text-ink shadow-sm" : "text-muted"}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="card p-6 text-muted">No points yet. Enter the cook-off or vote to get on the board.</p>
      ) : (
        <ol className="card divide-y divide-line">
          {rows.map((r) => {
            const isMe = me?.user.id === r.userId;
            return (
              <li key={r.userId} className={`grid grid-cols-[2.5rem_auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 ${isMe ? "bg-sunk" : ""}`}>
                <span className={`tabular font-mono text-lg font-semibold ${r.rank <= 3 ? "text-basil" : "text-muted"}`}>#{r.rank}</span>
                <LevelIcon index={r.levelIndex} size={36} />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">
                    {publicName(r.name)}
                    {isMe && <span className="ml-2 text-xs font-normal text-muted">you</span>}
                  </span>
                  <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    {r.level}
                    {r.badges.length > 0 && (
                      <span className="flex gap-1">
                        {r.badges.map((b) => (
                          <BadgeIcon key={b} id={b} size={22} />
                        ))}
                      </span>
                    )}
                  </span>
                </span>
                <span className="tabular font-mono text-lg">{r.points}</span>
              </li>
            );
          })}
        </ol>
      )}

      <section className="card flex flex-col gap-3 p-5">
        <h2 className="font-display text-xl font-bold">How to earn points</h2>
        <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          <li>Post a cook-off entry · <b>+{POINTS.post}</b></li>
          <li>Each vote you cast · <b>+{POINTS.vote_cast}</b></li>
          <li>Each vote you receive · <b>+{POINTS.vote_received}</b></li>
          <li>Friend signs up from your link · <b>+{POINTS.referral_signup}</b></li>
          <li>That friend cooks · <b>+{POINTS.referral_cook}</b></li>
          <li>Weekly streak · <b>+{streakBonus(2)}, +{streakBonus(3)}, +{streakBonus(4)}…</b></li>
          <li>Verify your price with a receipt · <b>+{POINTS.receipt}</b></li>
          <li>Top 10 finish · <b>+{POINTS.top10}</b></li>
          <li>Thriftiest copy · <b>+{POINTS.thriftiest}</b></li>
          <li>Crowd favorite or Chef&apos;s pick · <b>+{POINTS.win}</b></li>
        </ul>
        <div className="flex flex-col gap-2">
          <span className="label">Levels</span>
          <LevelLadder />
          <p className="text-sm text-muted">Levels come from all-time points. The month&apos;s top scorer wins a grocery gift card.</p>
        </div>
      </section>
    </main>
  );
}
