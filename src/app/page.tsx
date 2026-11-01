import { Snapper } from "@/components/Snapper";
import { RecipeTile } from "@/components/RecipeTile";
import { WaitlistForm } from "@/components/WaitlistForm";
import { getCurrentChallenge, getMe, getRecentPublicRecipes, isLive } from "@/lib/data";
import { timeLeft } from "@/lib/game";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [me, recent, challenge] = await Promise.all([
    getMe().catch(() => null),
    getRecentPublicRecipes(6).catch(() => []),
    getCurrentChallenge().catch(() => null),
  ]);

  return (
    <main className="flex flex-col gap-16 pt-8 sm:pt-12">
      <section className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)]">
        <div className="flex min-w-0 flex-col gap-6">
          <span className="label">Restaurant copycats</span>
          <h1 className="font-display text-5xl font-bold leading-[1.02] tracking-tight sm:text-6xl">
            Snap the restaurant plate. <span className="text-basil">Make it for less.</span>
          </h1>
          <p className="max-w-[58ch] text-lg text-muted">
            Upload a photo of a dish you ate out. Plateful identifies it, writes a copycat recipe for your table, shows what you
            save per plate, and builds the grocery list. Then post your version next to the original.
          </p>
          <ol className="grid max-w-xl grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Snap", "Photo of the dish"],
              ["Recipe", "Scaled to your table"],
              ["Shop", "Instacart, Walmart, Kroger"],
              ["Share", "Restaurant vs. mine"],
            ].map(([t, d]) => (
              <li key={t} className="border-t-2 border-basil pt-2 text-sm">
                <b className="block font-display text-base">{t}</b>
                <span className="text-muted">{d}</span>
              </li>
            ))}
          </ol>
        </div>
        <Snapper signedIn={!!me} />
      </section>

      {challenge && (
        <section className="card flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="label">{isLive(challenge) ? `This week's cook-off · ${timeLeft(challenge.ends_at)}` : "Cook-off results"}</span>
            <h2 className="font-display text-3xl font-bold tracking-tight">{challenge.title}</h2>
            {challenge.blurb && <p className="text-muted">{challenge.blurb}</p>}
          </div>
          <Link href="/cookoff" className="btn btn-sun shrink-0">
            {isLive(challenge) ? "Join the cook-off" : "See the winners"}
          </Link>
        </section>
      )}

      {recent.length > 0 && (
        <section className="flex flex-col gap-5">
          <div className="flex items-end justify-between gap-4">
            <h2 className="font-display text-3xl font-bold tracking-tight">Fresh copycats</h2>
            <span className="text-sm text-muted">Made by Plateful cooks</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((r) => (
              <RecipeTile key={r.id} recipe={r} />
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-6 rounded-3xl bg-basil p-6 text-basil-ink sm:p-10 lg:grid-cols-2 lg:items-center">
        <div>
          <h2 className="font-display text-3xl font-bold tracking-tight">One copycat a week, in your inbox</h2>
          <p className="mt-2 opacity-85">The week&apos;s cook-off dish, the price gap, and the best attempts from the community.</p>
        </div>
        <WaitlistForm />
      </section>
    </main>
  );
}
