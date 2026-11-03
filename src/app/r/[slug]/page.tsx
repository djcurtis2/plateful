import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAttempts, getMe, getPantry, getRecipeBySlug, getRecipesByIds, isSaved } from "@/lib/data";
import { menuPlate, savings } from "@/lib/recipe";
import { money } from "@/lib/format";
import { siteUrl } from "@/lib/env";
import { RecipeView } from "@/components/RecipeView";
import { ReferralBeacon } from "@/components/ReferralBeacon";
import { AttemptGallery } from "@/components/AttemptGallery";
import { UseItUp } from "@/components/UseItUp";
import { VersionMaker } from "@/components/VersionMaker";
import { getVersions } from "@/lib/data";
import { originalsLeft } from "@/lib/originals";
import { VERSIONS, VERSION_IDS, dietMisses } from "@/lib/diet";
import { AdminButton } from "@/components/AdminButton";
import { deleteOwnRecipe } from "@/app/actions";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const r = await getRecipeBySlug(slug);
  if (!r) return { title: "Recipe not found" };
  const s = savings(r);
  const title = r.restaurant ? `${r.restaurant} ${r.dish} copycat` : `${r.dish} recipe`;
  const description = s
    ? `${money(menuPlate(r))} a plate at ${r.restaurant}, ${money(r.plate_cost)} a plate at home. ${r.minutes ?? 30} minutes.`
    : `Make ${r.dish} at home in ${r.minutes ?? 30} minutes.`;
  return { title, description, alternates: { canonical: `/r/${r.slug}` }, openGraph: { title, description } };
}

export default async function RecipePage({ params }: Params) {
  const { slug } = await params;
  const recipe = await getRecipeBySlug(slug);
  if (!recipe) notFound();

  const me = await getMe();
  const [pantry, savedState, attempts] = await Promise.all([
    me ? getPantry(me.user.id) : Promise.resolve([]),
    me ? isSaved(me.user.id, recipe.id) : Promise.resolve({ saved: false, cooked: false }),
    getAttempts({ recipeId: recipe.id }, 12),
  ]);

  // Versions ("Make it my way"): this recipe's original and its sibling versions.
  const rootId = recipe.variant_of ?? recipe.id;
  const [root, versions, tries] = await Promise.all([
    recipe.variant_of ? getRecipesByIds([recipe.variant_of]).then((r) => r[0] ?? null) : Promise.resolve(recipe),
    getVersions(rootId),
    me ? originalsLeft(me.user.id, me.plus) : Promise.resolve(0),
  ]);
  const myDiets = me?.profile?.diets ?? [];
  const suggest = root ? VERSION_IDS.filter((k) => VERSIONS[k].diet && dietMisses(root, myDiets).includes(VERSIONS[k].diet!)) : [];
  const versionOf =
    recipe.variant_of && root ? { slug: root.slug, dish: root.dish, label: VERSIONS[recipe.variant_kind as keyof typeof VERSIONS]?.label ?? "New" } : null;

  const ref = me?.profile?.referral_code;
  const hasEntry = !!me && attempts.some((a) => a.user_id === me.user.id);
  const shareUrl = `${siteUrl}/r/${recipe.slug}${ref ? `?ref=${ref}` : ""}`;
  // Your own recipes are private: no shared versions, no public gallery.
  const own = recipe.source === "own";

  return (
    <main className="flex flex-col gap-14 pt-8">
      <Suspense>
        <ReferralBeacon recipeId={recipe.id} />
      </Suspense>
      <RecipeView
        recipe={recipe}
        shareUrl={shareUrl}
        signedIn={!!me}
        pantry={pantry}
        initiallySaved={savedState.saved}
        initiallyCooked={savedState.cooked}
        hasEntry={hasEntry}
        myDiets={myDiets}
        versionOf={versionOf}
      />
      {own && (
        <section className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">Only you can see this recipe. Prices are estimates.</p>
          <span className="flex flex-wrap items-center gap-2">
            <Link href={`/plan?new=1&include=${recipe.slug}`} className="btn btn-primary btn-sm">
              Put it in my week
            </Link>
            <AdminButton action={deleteOwnRecipe.bind(null, recipe.id)} label="Delete" confirm="delete" className="btn btn-ghost btn-sm" />
          </span>
        </section>
      )}
      {root && !own && (
        <VersionMaker
          recipeId={root.id}
          signedIn={!!me}
          plus={!!me?.plus}
          triesLeft={tries}
          existing={versions.map((v) => ({ kind: v.variant_kind ?? "", slug: v.slug, dish: v.dish }))}
          suggest={suggest}
          already={root.diet_tags}
          next={`/r/${recipe.slug}`}
        />
      )}
      <Suspense>
        <UseItUp recipe={recipe} userId={me?.user.id ?? null} plus={!!me?.plus} pantry={pantry} cooked={savedState.cooked} diets={myDiets} />
      </Suspense>
      {!own && (
        <section className="flex flex-col gap-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="font-display text-3xl font-bold tracking-tight">Who made it</h2>
            <span className="text-sm text-muted">
              {attempts.length ? `${attempts.length} ${attempts.length === 1 ? "cook" : "cooks"}` : "Be the first"}
            </span>
          </div>
          {!hasEntry && (
            <p className="rounded-2xl bg-sunk px-4 py-3 text-sm">
              Made it?{" "}
              {me ? (
                <>Add your photo to the card above. It posts here when you share.</>
              ) : (
                <>
                  <Link href={`/login?next=/r/${recipe.slug}`} className="font-semibold text-basil underline">
                    Sign in
                  </Link>{" "}
                  to post your version here.
                </>
              )}
            </p>
          )}
          <AttemptGallery attempts={attempts} signedIn={!!me} myId={me?.user.id} recipe={recipe} shareUrl={shareUrl} />
        </section>
      )}
    </main>
  );
}
