import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAttempts, getMe, getPantry, getRecipeBySlug, getRecipesByIds, getShareToken, getSharedRecipe, isSaved } from "@/lib/data";
import type { Recipe } from "@/lib/recipe";
import { menuPlate, savings } from "@/lib/recipe";
import { money } from "@/lib/format";
import { siteUrl } from "@/lib/env";
import { RecipeView } from "@/components/RecipeView";
import { krogerConfigured } from "@/lib/kroger-server";
import { ReferralBeacon } from "@/components/ReferralBeacon";
import { AttemptGallery } from "@/components/AttemptGallery";
import { UseItUp } from "@/components/UseItUp";
import { VersionMaker } from "@/components/VersionMaker";
import { getVersions } from "@/lib/data";
import { originalsLeft } from "@/lib/originals";
import { VERSIONS, VERSION_IDS, dietMisses } from "@/lib/diet";
import { AdminButton } from "@/components/AdminButton";
import { deleteOwnRecipe } from "@/app/actions";
import { ShareOwnRecipe } from "@/components/ShareOwnRecipe";
import { CopySharedRecipe } from "@/components/CopySharedRecipe";

type Params = { params: Promise<{ slug: string }>; searchParams: Promise<{ k?: string }> };

export async function generateMetadata({ params, searchParams }: Params): Promise<Metadata> {
  const { slug } = await params;
  const { k } = await searchParams;
  const r = await getRecipeBySlug(slug);
  if (!r) {
    const shared = k ? await getSharedRecipe(slug, k) : null;
    // Shared-by-link recipes get a title for the chat preview but stay out of search engines.
    return shared ? { title: `${shared.dish} recipe`, robots: { index: false, follow: false } } : { title: "Recipe not found" };
  }
  if (r.source === "own") return { title: `${r.dish} recipe`, robots: { index: false, follow: false } };
  const s = savings(r);
  const title = r.restaurant ? `${r.restaurant} ${r.dish} copycat` : `${r.dish} recipe`;
  const description = s
    ? `${money(menuPlate(r))} a plate at ${r.restaurant}, ${money(r.plate_cost)} a plate at home. ${r.minutes ?? 30} minutes.`
    : `Make ${r.dish} at home in ${r.minutes ?? 30} minutes.`;
  return { title, description, alternates: { canonical: `/r/${r.slug}` }, openGraph: { title, description } };
}

export default async function RecipePage({ params, searchParams }: Params) {
  const { slug } = await params;
  const { k } = await searchParams;
  const recipe = await getRecipeBySlug(slug);
  if (!recipe) {
    const shared = k ? await getSharedRecipe(slug, k) : null;
    if (!shared) notFound();
    return <SharedRecipe recipe={shared} token={k!} />;
  }

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
  // undefined = not the owner (no share controls); null = owner, not shared yet.
  const shareToken = own && me ? await getShareToken(me.user.id, recipe.id).catch(() => null) : undefined;

  return (
    <main className="flex flex-col gap-14 pt-8">
      <Suspense>
        <ReferralBeacon recipeId={recipe.id} />
      </Suspense>
      <RecipeView
        kroger={krogerConfigured()}
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
        <section className="card flex flex-col gap-3 p-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <p className="text-sm text-muted">Only you, and anyone you send a link to, can see this recipe. Prices are estimates.</p>
          <span className="flex flex-wrap items-center gap-2">
            <Link href={`/plan?new=1&include=${recipe.slug}`} className="btn btn-primary btn-sm">
              Put it in my week
            </Link>
            <AdminButton action={deleteOwnRecipe.bind(null, recipe.id)} label="Delete" confirm="delete" className="btn btn-ghost btn-sm" />
          </span>
          {shareToken !== undefined && (
            <div className="sm:basis-full">
              <ShareOwnRecipe recipeId={recipe.id} dish={recipe.dish} initialUrl={shareToken ? `${siteUrl}/r/${recipe.slug}?k=${shareToken}` : null} />
            </div>
          )}
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

/** Someone's own recipe opened from their share link: read it, and save your own copy to plan with. */
async function SharedRecipe({ recipe, token }: { recipe: Recipe; token: string }) {
  const me = await getMe();
  const pantry = me ? await getPantry(me.user.id) : [];
  return (
    <main className="flex flex-col gap-10 pt-8">
      <section className="card flex flex-col gap-3 border-saffron p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="label">Shared with you</span>
          <p className="text-sm text-muted">A Yumjack cook shared their own recipe with you. Only people with the link can see it.</p>
        </div>
        <CopySharedRecipe slug={recipe.slug} token={token} signedIn={!!me} />
      </section>
      <RecipeView
        kroger={krogerConfigured()}
        recipe={recipe}
        shareUrl=""
        signedIn={!!me}
        pantry={pantry}
        initiallySaved={false}
        initiallyCooked={false}
        myDiets={me?.profile?.diets ?? []}
        shared
      />
    </main>
  );
}
