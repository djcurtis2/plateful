import Link from "next/link";
import { fitsDiets } from "@/lib/diet";
import Image from "next/image";
import { DishArt } from "@/components/DishArt";
import type { Recipe } from "@/lib/recipe";
import { leftoversFor, shareLabel, useItUp } from "@/lib/leftovers";
import { pantryKey, money } from "@/lib/format";
import { getSuggestionPool } from "@/lib/data";
import { recipeLabel } from "@/lib/recipe";
import { LeftoverMaker } from "@/components/LeftoverMaker";
import { originalsLeft } from "@/lib/originals";

/**
 * "Use it up": what you'll have left after this recipe, and other copycats that use it.
 * Buy once, cook twice: the leftover chipotles from the tacos go into Tuesday's burrito bowl.
 */
export async function UseItUp({
  recipe,
  userId,
  plus,
  pantry,
  cooked,
  diets = [],
}: {
  recipe: Recipe;
  userId: string | null;
  plus: boolean;
  pantry: string[];
  cooked: boolean;
  diets?: string[];
}) {
  const left = leftoversFor(recipe.ingredients, pantry.map(pantryKey));
  if (!left.length) return null;
  // One suggestion per dish: several people may have snapped the same thing.
  const sameDish = (r: Recipe) => `${r.restaurant ?? ""}|${r.dish}`.toLowerCase();
  const seen = new Set([sameDish(recipe)]);
  const pool = (await getSuggestionPool(userId)).filter((r) => fitsDiets(r, diets) && !seen.has(sameDish(r)) && seen.add(sameDish(r)));
  const picks = useItUp(left, pool, recipe.id, 3);
  const tries = userId ? await originalsLeft(userId, plus) : 0;
  const total = left.reduce((s, l) => s + l.value, 0);

  return (
    <section className="flex flex-col gap-4" aria-labelledby="use-it-up">
      <div>
        <span className="label">{cooked ? "You made it" : "Buy once, cook twice"}</span>
        <h2 id="use-it-up" className="font-display text-3xl font-bold tracking-tight">
          {cooked ? "Use up your leftovers" : "What you'll have left over"}
        </h2>
        <p className="text-muted">
          About <span className="tabular font-mono">{money(total)}</span> of groceries won&apos;t get used by this recipe.{" "}
          {picks.length ? "These recipes use them, so nothing goes to waste." : "Make something new with them below."}
        </p>
      </div>

      <ul className="flex flex-wrap gap-2">
        {left.map((l) => (
          <li key={l.key} className="rounded-full border border-line bg-surface px-3 py-1 text-sm">
            <span className="font-semibold">{l.name}</span> <span className="text-muted">· {shareLabel(l)} left</span>
          </li>
        ))}
      </ul>

      {picks.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-3">
          {picks.map(({ recipe: r, uses, value }, i) =>
            // Plus-only picks never reach the page: a stand-in card with just what it uses, so the blur hides nothing real.
            !plus && i > 0 ? (
              <li key={`locked-${i}`} className="relative">
                <Link href="/pricing" className="absolute inset-0 z-10 grid place-items-center rounded-3xl bg-bg/40 text-sm font-semibold backdrop-blur-[6px]">
                  <span className="rounded-full bg-saffron px-3 py-1.5 text-saffron-ink">See it with Plus</span>
                </Link>
                <div aria-hidden className="card flex h-full gap-3 overflow-hidden p-3">
                  <span className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-sunk">
                    <DishArt dish={`locked ${i}`} ingredients={uses.map((u) => u.name)} seed={`locked-${i}`} />
                  </span>
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="font-display font-bold leading-tight">A recipe for your leftovers</span>
                    <span className="text-xs text-muted">Uses your {uses.map((u) => u.name.replace(/,.*$/, "")).join(", ")}</span>
                    <span className="tabular font-mono text-xs text-basil">uses ~{money(value)} of leftovers</span>
                  </span>
                </div>
              </li>
            ) : (
            <li key={r.id}>
              <Link href={`/r/${r.slug}`} className="card group flex h-full gap-3 overflow-hidden p-3 hover:border-basil">
                <span className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-sunk">
                  {r.image_url ? (
                    <Image src={r.image_url} alt="" fill sizes="80px" className="object-cover" />
                  ) : (
                    <DishArt dish={r.dish} ingredients={r.ingredients.map((i) => i.name)} seed={r.slug} />
                  )}
                </span>
                <span className="flex min-w-0 flex-col gap-1">
                  {recipeLabel(r) && <span className="label truncate">{recipeLabel(r)}</span>}
                  <span className="font-display font-bold leading-tight group-hover:text-basil">{r.dish}</span>
                  <span className="text-xs text-muted">
                    Uses your {uses.map((u) => u.name.replace(/,.*$/, "")).join(", ")}
                  </span>
                  <span className="tabular font-mono text-xs text-basil">uses ~{money(value)} of leftovers</span>
                </span>
              </Link>
            </li>
            ),
          )}
        </ul>
      )}
      <LeftoverMaker recipeId={recipe.id} signedIn={!!userId} next={`/r/${recipe.slug}`} few={picks.length < 3} plus={plus} triesLeft={tries} />
      <Link href={`/plan?new=1&include=${recipe.slug}`} className="card flex flex-wrap items-center justify-between gap-3 p-4 hover:border-basil">
        <span>
          <span className="block font-display text-lg font-bold">Plan a week around this dish</span>
          <span className="text-sm text-muted">Meals that share its groceries, one shopping list.{plus ? "" : " Yumjack Plus."}</span>
        </span>
        <span className="btn btn-ghost btn-sm">Plan my week</span>
      </Link>
      {left.some((l) => !l.measured) && <p className="text-xs text-muted">Leftovers for older recipes are a best guess from what&apos;s usually sold in bigger packs.</p>}
    </section>
  );
}
