import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLatestPlan, getMe, getRecipesByIds, getSavedRecipes, getSuggestionPool } from "@/lib/data";
import { PLAN_MEAL_LABELS, WEEKDAYS, fitsMeal } from "@/lib/planner";
import { recipeLabel } from "@/lib/recipe";
import { fitsDiets } from "@/lib/diet";
import { RecipePicker, type PickItem } from "@/components/RecipePicker";

export const metadata: Metadata = { title: "Pick a recipe" };
export const dynamic = "force-dynamic";

type Search = { searchParams: Promise<{ slot?: string }> };

/** Choose anything for one spot in the week: your own recipes, saved ones, or any public recipe. */
export default async function PickPage({ searchParams }: Search) {
  const sp = await searchParams;
  const me = await getMe();
  if (!me) redirect(`/login?next=${encodeURIComponent(`/plan/pick?slot=${sp.slot ?? ""}`)}`);
  if (!me.plus) redirect("/plan");
  const plan = await getLatestPlan(me.user.id);
  const index = Number(sp.slot);
  if (!plan || !Number.isInteger(index) || !plan.slots[index]) notFound();
  const at = plan.slots[index];

  const [saved, pool] = await Promise.all([getSavedRecipes(me.user.id), getSuggestionPool(me.user.id, 400)]);
  const mine = new Set(saved.map((x) => x.recipe.id));
  const diets = me.profile?.diets ?? [];
  const seen = new Set<string>();
  const items: PickItem[] = [];
  for (const r of pool) {
    if (seen.has(r.id) || !r.ingredients?.length) continue;
    seen.add(r.id);
    items.push({
      id: r.id,
      dish: r.dish,
      label: recipeLabel(r),
      image: r.image_url,
      minutes: r.minutes,
      plate: r.plate_cost,
      mine: mine.has(r.id),
      own: r.source === "own",
      fits: fitsMeal(r, at.meal),
      offDiet: diets.length > 0 && !fitsDiets(r, diets),
    });
  }
  const dinner = plan.slots.find((x) => x.day === at.day - 1 && x.meal === "dinner" && x.id && !x.leftover);
  const [last] = at.meal === "lunch" && dinner ? await getRecipesByIds([dinner.id!]) : [];
  const meal = PLAN_MEAL_LABELS[at.meal];
  const back = `/plan/pick?slot=${index}`;

  return (
    <main className="flex flex-col gap-6 pt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/plan" className="text-sm text-muted underline">
            Back to my week
          </Link>
          <h1 className="font-display text-4xl font-bold tracking-tight">
            {meal} on {WEEKDAYS[at.day]}
          </h1>
          <p className="text-muted">Pick anything: your own recipes, ones you&apos;ve saved, or any recipe on Dupe Kitchen.</p>
        </div>
        <Link href={`/library/new?meal=${at.meal}&next=${encodeURIComponent(back)}`} className="btn btn-ghost btn-sm">
          Add my own recipe
        </Link>
      </div>
      <RecipePicker
        planId={plan.id}
        index={index}
        meal={meal.toLowerCase()}
        current={at.leftover ? null : at.id}
        leftover={last ? { dish: last.dish, day: WEEKDAYS[at.day - 1] } : null}
        items={items}
      />
    </main>
  );
}
