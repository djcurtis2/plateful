import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getAttempt, getAttempts, getChallengeById, getMe, getRecipeBySlug, isLive, myVotes } from "@/lib/data";
import { admin } from "@/lib/supabase/admin";
import { publicName, standing, timeLeft, VOTES_PER_COOKOFF } from "@/lib/game";
import { money } from "@/lib/format";
import { menuPlate, savings } from "@/lib/recipe";
import { VoteButton } from "@/components/VoteButton";
import { ReferralBeacon } from "@/components/ReferralBeacon";
import { EntryChips } from "@/components/EntryChips";

type Params = { params: Promise<{ id: string }> };

async function load(id: string) {
  const entry = await getAttempt(id);
  if (!entry) return null;
  const { data: rec } = await admin().from("recipes").select("slug").eq("id", entry.recipe_id).maybeSingle();
  const recipe = rec ? await getRecipeBySlug(rec.slug) : null;
  const challenge = entry.challenge_id ? await getChallengeById(entry.challenge_id) : null;
  return recipe ? { entry, recipe, challenge } : null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const d = await load((await params).id);
  if (!d) return { title: "Entry not found" };
  const title = `Vote for ${publicName(d.entry.name)}'s ${d.recipe.dish}`;
  const s = savings(d.recipe);
  const description = s
    ? `Made at home for ${money(d.recipe.plate_cost)} a plate instead of ${money(menuPlate(d.recipe))} at ${d.recipe.restaurant}. Vote in the Plateful cook-off.`
    : "Vote in the Plateful cook-off.";
  return { title, description, openGraph: { title, description, images: [d.entry.image_url] } };
}

export default async function EntryPage({ params }: Params) {
  const { id } = await params;
  const d = await load(id);
  if (!d) notFound();
  const { entry, recipe, challenge } = d;
  const me = await getMe();
  const open = !!challenge && isLive(challenge);
  const [all, votes] = await Promise.all([
    challenge ? getAttempts({ challengeId: challenge.id }, 200) : Promise.resolve([entry]),
    me && challenge ? myVotes(me.user.id, challenge.id) : Promise.resolve([] as string[]),
  ]);
  const stand = standing(all, entry.id);
  const s = savings(recipe);
  const name = publicName(entry.name);
  const badge =
    challenge?.crowd_winner_attempt_id === entry.id
      ? "Crowd favorite"
      : challenge?.chef_pick_attempt_id === entry.id
        ? "Chef's pick"
        : challenge?.thriftiest_attempt_id === entry.id
          ? "Thriftiest copy"
          : null;
  const original = challenge?.reference_image_url ?? recipe.image_url;
  const homeCost = entry.cost_per_plate ?? recipe.plate_cost;
  const outPlate = menuPlate(recipe);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 pt-8">
      <Suspense>
        <ReferralBeacon recipeId={recipe.id} />
      </Suspense>
      <div className="flex flex-col gap-2">
        <span className="label">
          {challenge ? `${challenge.title} cook-off${open ? ` · ${timeLeft(challenge.ends_at)}` : " · ended"}` : "Who made it"}
        </span>
        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
          {name}&apos;s {recipe.dish}
        </h1>
        {entry.caption && <p className="text-lg text-muted">&ldquo;{entry.caption}&rdquo;</p>}
        {badge && <span className="w-fit rounded-md bg-saffron px-2 py-1 font-mono text-sm font-semibold text-saffron-ink">{badge}</span>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {[
          { tag: `The original${recipe.restaurant ? ` · ${recipe.restaurant}` : ""}`, src: original, price: menuPlate(recipe), home: false },
          { tag: `${name}'s copy`, src: entry.image_url, price: homeCost, home: true },
        ].map((p) => (
          <figure key={p.tag} className="flex flex-col gap-2">
            <div className="relative aspect-square overflow-hidden rounded-3xl bg-sunk">
              {p.src ? (
                <Image src={p.src} alt={p.tag} fill sizes="(max-width: 640px) 100vw, 450px" className="object-cover" priority />
              ) : (
                <div className="grid h-full place-items-center font-display text-3xl text-muted">{recipe.restaurant}</div>
              )}
              <span className="absolute left-3 top-3 rounded-full bg-ink/80 px-3 py-1 font-mono text-xs font-semibold text-bg">{p.tag}</span>
            </div>
            <figcaption className="tabular font-mono text-lg">
              {money(p.price)}
              {p.home ? ` a plate at home${entry.cost_per_plate == null ? " (recipe estimate)" : ""}` : " a plate on the menu"}
            </figcaption>
          </figure>
        ))}
      </div>

      {(entry.cost_per_plate != null || entry.minutes != null || entry.swaps || entry.notes) && (
        <section className="card flex flex-col gap-3 p-5">
          <EntryChips e={entry} size="md" showSwaps />
          {entry.cost_source === "receipt" && (
            <p className="text-xs text-muted">
              Price worked out by Plateful from {entry.receipt_store ? `a ${entry.receipt_store} receipt` : "a grocery receipt"}. The receipt itself isn&apos;t kept.
            </p>
          )}
          {entry.notes && (
            <div>
              <h2 className="label">How I made it</h2>
              <p className="mt-1 whitespace-pre-line">{entry.notes}</p>
            </div>
          )}
        </section>
      )}

      <section className="card grid gap-6 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="flex flex-col gap-1">
          {stand && challenge && (
            <p className="font-display text-2xl font-bold">
              #{stand.rank} of {stand.of} in this cook-off
            </p>
          )}
          {outPlate != null && homeCost != null && homeCost < outPlate ? (
            <p className="text-muted">
              Saved {money(outPlate - homeCost)} a plate, {Math.round((1 - homeCost / outPlate) * 100)}% less than {recipe.restaurant}.
            </p>
          ) : s ? (
            <p className="text-muted">
              The recipe saves {money(s.saved)} a plate, {s.pct}% less than {recipe.restaurant}.
            </p>
          ) : null}
          {challenge && (
            <p className="text-sm text-muted">
              Vote if it looks closest to the original. Everyone gets {VOTES_PER_COOKOFF} votes; most votes wins 3 months of Plus.{" "}
              <Link href="/rules" className="underline">
                Rules
              </Link>
            </p>
          )}
        </div>
        <div className="sm:w-72">
          {challenge ? (
            <VoteButton
              attemptId={entry.id}
              initialVotes={entry.votes}
              initialVoted={votes.includes(entry.id)}
              initialLeft={VOTES_PER_COOKOFF - votes.length}
              signedIn={!!me}
              open={open}
              own={me?.user.id === entry.user_id}
              next={`/cookoff/e/${entry.id}`}
            />
          ) : null}
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-3xl bg-basil p-6 text-basil-ink sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-display text-2xl font-bold">Think you can beat it?</p>
          <p className="opacity-85">Get the recipe, make it this week, and enter the cook-off yourself.</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/r/${recipe.slug}`} className="btn btn-sun">
            Get the recipe
          </Link>
          {challenge && (
            <Link href={open ? "/cookoff" : `/cookoff/c/${challenge.slug}`} className="btn border border-basil-ink/30">
              See all entries
            </Link>
          )}
        </div>
      </section>
    </main>
  );
}
