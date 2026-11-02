import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { CLUB_BY_ID, CLUB_MIN_MEMBERS } from "@/lib/clubs";
import { clubEntries, clubPopular, getRecipesByIds } from "@/lib/data";
import { publicName } from "@/lib/game";
import { ChefAvatar } from "@/components/ChefAvatar";
import { RecipeTile } from "@/components/RecipeTile";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const club = CLUB_BY_ID[(await params).id];
  return club ? { title: club.name, description: club.blurb } : { title: "Club not found" };
}

export default async function ClubPage({ params }: Params) {
  const club = CLUB_BY_ID[(await params).id];
  if (!club) notFound();

  const [popular, entries] = await Promise.all([clubPopular(club.id, 12), clubEntries(club.id, 12)]);
  const recipes = await getRecipesByIds([...new Set(entries.map((e) => e.recipe_id))]);
  const dishOf = new Map(recipes.map((r) => [r.id, r]));

  return (
    <main className="flex flex-col gap-8 pt-8">
      <div>
        <Link href="/clubs" className="label hover:underline">Chef clubs</Link>
        <h1 className="font-display text-4xl font-bold tracking-tight">{club.name}</h1>
        <p className="text-muted">{club.blurb}</p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-2xl font-bold">Popular with {club.name}</h2>
        {popular.length === 0 ? (
          <p className="text-muted">No recipes yet. A recipe shows up here once at least {CLUB_MIN_MEMBERS} members have made or saved it.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {popular.map(({ recipe, members }) => (
              <RecipeTile key={recipe.id} recipe={recipe} note={`Made or saved by ${members} members`} />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-2xl font-bold">Recent cook-off entries</h2>
        {entries.length === 0 ? (
          <p className="text-muted">No entries yet. Post a photo of a dish you made and it shows up here.</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {entries.map((a) => (
              <li key={a.id}>
                <Link href={`/cookoff/e/${a.id}`} className="card flex min-w-0 flex-col overflow-hidden hover:border-basil">
                  <span className="relative aspect-[4/3] bg-sunk">
                    <Image src={a.image_url} alt={a.caption ?? `${publicName(a.name)}'s version`} fill sizes="(max-width: 640px) 100vw, 33vw" className="object-cover" />
                  </span>
                  <span className="flex items-center gap-2 p-3">
                    <ChefAvatar avatar={a.chef.avatar} head size={36} uid={`${a.id}-club`} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{publicName(a.name)}</span>
                      {dishOf.get(a.recipe_id) && <span className="block truncate text-xs text-muted">{dishOf.get(a.recipe_id)!.dish}</span>}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
