import Link from "next/link";
import Image from "next/image";
import { getAttempts, getMe, getUpcomingChallenge, isLive, myVotes, type Challenge } from "@/lib/data";
import { playerStats } from "@/lib/game-server";
import { POINTS, PRIZES, VOTES_PER_COOKOFF, publicName, rankEntries, standing, timeLeft } from "@/lib/game";
import { money } from "@/lib/format";
import { savings } from "@/lib/recipe";
import { siteUrl } from "@/lib/env";
import { AttemptForm } from "@/components/AttemptForm";
import { CookoffBoard } from "@/components/CookoffBoard";
import { NameForm } from "@/components/NameForm";
import { LevelIcon } from "@/components/GameIcons";

/** One cook-off: live (enter, vote, rally) or ended (results). Used by /cookoff and past cook-off pages. */
export async function CookoffView({ challenge, isCurrent }: { challenge: Challenge; isCurrent: boolean }) {
  const [me, entries] = await Promise.all([getMe(), getAttempts({ challengeId: challenge.id }, 200)]);
  const live = isLive(challenge);
  const r = challenge.recipe;
  const s = savings(r);
  const ranked = rankEntries(entries);
  const mineEntry = me ? entries.find((e) => e.user_id === me.user.id) ?? null : null;
  const stand = mineEntry ? standing(entries, mineEntry.id) : null;
  const [votes, stats, upcoming] = await Promise.all([
    me ? myVotes(me.user.id, challenge.id) : Promise.resolve([]),
    me ? playerStats(me.user.id, live ? challenge.id : null) : Promise.resolve(null),
    !live && isCurrent ? getUpcomingChallenge() : Promise.resolve(null),
  ]);
  const refCode = me?.profile?.referral_code ?? null;
  const recipeShare = `${siteUrl}/r/${r.slug}${refCode ? `?ref=${refCode}` : ""}`;
  const cooks = new Set(entries.map((e) => e.user_id)).size;
  const crowd = entries.find((e) => e.id === challenge.crowd_winner_attempt_id) ?? null;
  const chef = entries.find((e) => e.id === challenge.chef_pick_attempt_id) ?? null;
  const thrifty = entries.find((e) => e.id === challenge.thriftiest_attempt_id) ?? null;
  const ends = new Date(challenge.ends_at).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

  return (
    <main className="flex flex-col gap-10 pt-8">
      <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:items-center">
        <div className="flex min-w-0 flex-col gap-4">
          <span className="label">
            {live ? `This week's cook-off · ${timeLeft(challenge.ends_at)}` : challenge.finalized_at ? `Cook-off results · ended ${ends}` : `Voting closed ${ends} · results coming`}
          </span>
          <h1 className="font-display text-5xl font-bold tracking-tight">{challenge.title}</h1>
          {challenge.blurb && <p className="max-w-[58ch] text-lg text-muted">{challenge.blurb}</p>}
          {s && (
            <p className="tabular font-mono">
              {money(r.menu_price)} at {r.restaurant} · {money(r.plate_cost)} a plate at home ·{" "}
              <span className="rounded bg-saffron px-1.5 text-saffron-ink">{s.pct}% less</span>
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Link href={`/r/${r.slug}`} className="btn btn-primary">
              Get the recipe
            </Link>
            <span className="text-sm text-muted">
              {cooks} {cooks === 1 ? "cook" : "cooks"} entered · {VOTES_PER_COOKOFF} votes each ·{" "}
              <Link href="/rules" className="underline">
                Rules
              </Link>
            </span>
          </div>
        </div>
        {challenge.reference_image_url && (
          <figure className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-sunk">
            <Image src={challenge.reference_image_url} alt={`${r.dish} at ${r.restaurant ?? "the restaurant"}`} fill priority sizes="420px" className="object-cover" />
            <figcaption className="absolute left-3 top-3 rounded-full bg-ink/80 px-3 py-1 font-mono text-xs font-semibold text-bg">
              The original{r.restaurant ? ` · ${r.restaurant}` : ""}
            </figcaption>
          </figure>
        )}
      </section>

      {live && (
        <section className="grid gap-3 sm:grid-cols-3">
          <div className="card flex flex-col gap-1 p-5">
            <span className="label">Crowd favorite</span>
            <p className="font-display text-lg font-bold">Most votes wins</p>
            <p className="text-sm text-muted">{PRIZES.crowd_favorite.plusMonths} months of Plus, a winner badge, and a feature on Plateful&apos;s homepage and socials.</p>
          </div>
          <div className="card flex flex-col gap-1 p-5">
            <span className="label">Chef&apos;s pick</span>
            <p className="font-display text-lg font-bold">Best-looking copy</p>
            <p className="text-sm text-muted">Picked by the Plateful kitchen. Same prize, so a great plate can win without a big following.</p>
          </div>
          <div className="card flex flex-col gap-1 p-5">
            <span className="label">Thriftiest copy</span>
            <p className="font-display text-lg font-bold">Cheapest verified plate</p>
            <p className="text-sm text-muted">
              Lowest price per plate backed by a receipt. {PRIZES.thriftiest.plusMonths} month of Plus and a badge. Add your receipt when you post.
            </p>
          </div>
        </section>
      )}

      {!live && (
        <section className="flex flex-col gap-4">
          <h2 className="font-display text-3xl font-bold tracking-tight">{challenge.finalized_at ? "Winners" : "Results are being tallied"}</h2>
          {challenge.finalized_at ? (
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { label: "Crowd favorite", e: crowd },
                { label: "Chef's pick", e: chef },
                { label: "Thriftiest copy", e: thrifty },
              ].map(({ label, e }) => (
                <div key={label} className="card flex gap-4 overflow-hidden p-3">
                  {e ? (
                    <>
                      <Link href={`/cookoff/e/${e.id}`} className="relative size-28 shrink-0 overflow-hidden rounded-2xl bg-sunk">
                        <Image src={e.image_url} alt="" fill sizes="112px" className="object-cover" />
                      </Link>
                      <div className="flex min-w-0 flex-col justify-center gap-1">
                        <span className="w-fit rounded-md bg-saffron px-2 py-0.5 font-mono text-xs font-semibold text-saffron-ink">{label}</span>
                        <p className="truncate font-display text-xl font-bold">{publicName(e.name)}</p>
                        <p className="tabular font-mono text-sm text-muted">
                          {label === "Thriftiest copy" ? `${money(e.cost_per_plate)} a plate ✓ Receipt` : `▲ ${e.votes} votes`}
                        </p>
                      </div>
                    </>
                  ) : (
                    <p className="p-3 text-muted">{label}: no winner this week.</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted">Voting has closed. Winners are announced once the Plateful kitchen picks the Chef&apos;s pick.</p>
          )}
          {upcoming && (
            <div className="card flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="label">Next cook-off · starts {new Date(upcoming.starts_at).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</span>
                <p className="font-display text-2xl font-bold">{upcoming.title}</p>
              </div>
              <Link href={`/r/${upcoming.recipe.slug}`} className="btn btn-sun">
                Get a head start
              </Link>
            </div>
          )}
        </section>
      )}

      {me && stats && (
        <section className="card grid gap-4 p-5 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <span className="label">Your standing</span>
            {stand ? (
              <p className="font-display text-2xl font-bold">
                #{stand.rank} of {stand.of}
                {live && stand.behindNext > 0 && (
                  <span className="block text-base font-medium text-muted">
                    {stand.behindNext} {stand.behindNext === 1 ? "vote" : "votes"} to pass #{stand.rank - 1}
                  </span>
                )}
                {live && stand.rank === 1 && stand.votes > 0 && <span className="block text-base font-medium text-basil">You&apos;re in the lead. Keep sharing.</span>}
              </p>
            ) : (
              <p className="font-display text-2xl font-bold">{live ? "Not entered yet" : "Didn't enter"}</p>
            )}
          </div>
          <div>
            <span className="label">Points</span>
            <p className="flex items-center gap-2">
              <LevelIcon index={stats.level.index} size={30} />
              <span className="tabular font-mono text-2xl font-semibold">{stats.points}</span>
            </p>
            <p className="text-xs text-muted">
              {stats.level.name}
              {stats.level.next ? ` · ${stats.level.toNext} to ${stats.level.next}` : ""}
            </p>
          </div>
          <div>
            <span className="label">Streak</span>
            <p className="tabular font-mono text-2xl font-semibold">
              {stats.streak} {stats.streak === 1 ? "week" : "weeks"}
            </p>
            <p className="text-xs text-muted">{stats.streak >= 1 ? "Enter next week to keep it going" : `Enter to start one (+${POINTS.post} points)`}</p>
          </div>
          {!me.profile?.public_name && (
            <div className="sm:col-span-4">
              <NameForm compact />
            </div>
          )}
        </section>
      )}

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-3xl font-bold tracking-tight">Entries</h2>
          <Link href="/leaderboard" className="text-sm font-semibold text-basil underline">
            Points leaderboard
          </Link>
        </div>
        {live && (
          <AttemptForm
            recipe={r}
            challengeId={challenge.id}
            signedIn={!!me}
            existing={mineEntry}
            next="/cookoff"
            shareUrl={recipeShare}
          />
        )}
        <CookoffBoard
          entries={live ? entries : ranked}
          recipe={r}
          myId={me?.user.id ?? null}
          myVotes={votes}
          open={live}
          chefPickId={challenge.chef_pick_attempt_id}
          crowdWinnerId={challenge.crowd_winner_attempt_id}
          thriftiestId={challenge.thriftiest_attempt_id}
          referenceUrl={challenge.reference_image_url}
          siteUrl={siteUrl}
          refCode={refCode}
          loginNext={isCurrent ? "/cookoff" : `/cookoff/c/${challenge.slug}`}
        />
      </section>

      <p className="text-sm text-muted">
        <Link href="/cookoff/past" className="font-semibold text-basil underline">
          Hall of fame
        </Link>{" "}
        · past cook-offs and their winners
      </p>
    </main>
  );
}
