import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getAttempts, getPastChallenges } from "@/lib/data";
import { publicName } from "@/lib/game";

export const metadata: Metadata = { title: "Hall of fame" };
export const dynamic = "force-dynamic";

export default async function HallOfFame() {
  const past = await getPastChallenges();
  const rows = await Promise.all(
    past.map(async (c) => {
      const entries = await getAttempts({ challengeId: c.id }, 200);
      return {
        c,
        count: entries.length,
        crowd: entries.find((e) => e.id === c.crowd_winner_attempt_id) ?? null,
        chef: entries.find((e) => e.id === c.chef_pick_attempt_id) ?? null,
      };
    }),
  );

  return (
    <main className="flex flex-col gap-6 pt-8">
      <div>
        <span className="label">Cook-off</span>
        <h1 className="font-display text-4xl font-bold tracking-tight">Hall of fame</h1>
        <p className="text-muted">Every past cook-off and its winners.</p>
      </div>
      {rows.length === 0 ? (
        <p className="text-muted">No finished cook-offs yet. The first winners land here.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map(({ c, count, crowd, chef }) => (
            <li key={c.id}>
              <Link href={`/cookoff/c/${c.slug}`} className="card flex flex-wrap items-center gap-4 p-4 hover:border-basil">
                <div className="min-w-0 flex-1">
                  <p className="label">
                    {new Date(c.ends_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · {count} entries
                  </p>
                  <p className="font-display text-xl font-bold">{c.title}</p>
                </div>
                {[{ l: "Crowd favorite", e: crowd }, { l: "Chef's pick", e: chef }].map(({ l, e }) =>
                  e ? (
                    <div key={l} className="flex items-center gap-2">
                      <span className="relative size-12 overflow-hidden rounded-xl bg-sunk">
                        <Image src={e.image_url} alt="" fill sizes="48px" className="object-cover" />
                      </span>
                      <span className="text-sm">
                        <span className="block text-xs text-muted">{l}</span>
                        {publicName(e.name)}
                      </span>
                    </div>
                  ) : null,
                )}
                {!c.finalized_at && <span className="text-sm text-muted">Results coming</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
