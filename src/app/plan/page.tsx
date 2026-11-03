import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getCurrentChallenge, getLatestPlan, getMe, getPantry, getRecipeBySlug, getRecipesByIds, getSuggestionPool, isLive } from "@/lib/data";
import { pantryKey, money } from "@/lib/format";
import { eligible, planWeek, summarize, WEEKDAYS, type Plan } from "@/lib/planner";
import { recipeLabel } from "@/lib/recipe";
import { shareLabel } from "@/lib/leftovers";
import { PlanForm } from "@/components/PlanForm";
import { DIETS } from "@/lib/diet";
import { refreshFromStripe } from "@/lib/billing";
import { GroceryList } from "@/components/GroceryList";
import { AdminButton } from "@/components/AdminButton";
import { fillPlanGap, markPlanMealCooked, removePlanMeal, swapPlanMeal } from "./actions";
import { cookedSince } from "@/lib/savings-server";

export const metadata: Metadata = { title: "Plan my week" };
export const dynamic = "force-dynamic";

type Search = { searchParams: Promise<{ new?: string; include?: string }> };

export default async function PlanPage({ searchParams }: Search) {
  const sp = await searchParams;
  let me = await getMe();
  if (me && !me.plus && me.profile?.stripe_customer_id && (await refreshFromStripe(me.user.id, me.profile.stripe_customer_id))) me = await getMe();
  if (!me) redirect(`/login?next=${encodeURIComponent(`/plan${sp.include ? `?new=1&include=${sp.include}` : ""}`)}`);

  const [pool, pantry] = await Promise.all([getSuggestionPool(me.user.id, 400), getPantry(me.user.id)]);
  const pantryKeys = pantry.map(pantryKey);

  // Free accounts: a real example week, with the parts that make it useful behind Plus.
  if (!me.plus) {
    const example = summarize(planWeek(pool, { dinners: 5, servings: 2, maxMinutes: null, cuisines: [], diets: me.profile?.diets ?? [] }, pantryKeys), 2, pantryKeys);
    return (
      <main className="flex flex-col gap-8 pt-8">
        <Intro />
        <section className="card flex flex-col gap-4 border-saffron p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="label">Dupe Kitchen Plus</span>
            <p className="font-display text-2xl font-bold">Plan a week of dinners that share groceries</p>
            <p className="text-muted">One shopping list, nothing wasted, and new recipes for whatever&apos;s left. Here&apos;s an example week.</p>
          </div>
          <Link href="/pricing" className="btn btn-sun shrink-0">
            Get Plus
          </Link>
        </section>
        <Headline plan={example} servings={2} />
        <Meals plan={example} />
        <div className="relative">
          <div aria-hidden className="pointer-events-none select-none blur-sm">
            <section className="card p-5">
              <h2 className="font-display text-2xl font-bold">Shopping list</h2>
              <ul className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
                {example.groceries.slice(0, 14).map((g) => (
                  <li key={g.key}>
                    {g.name} · {g.buy}
                  </li>
                ))}
              </ul>
            </section>
          </div>
          <div className="absolute inset-0 grid place-items-center">
            <Link href="/pricing" className="btn btn-primary shadow-xl">
              Unlock your shopping list with Plus
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const plan = sp.new ? null : await getLatestPlan(me.user.id);

  if (!plan) {
    const [challenge, include] = await Promise.all([getCurrentChallenge(), sp.include ? getRecipeBySlug(sp.include) : Promise.resolve(null)]);
    const cuisines = [...new Set(eligible(pool, { dinners: 7, servings: 2, maxMinutes: null, cuisines: [], diets: me.profile?.diets ?? [] }).map((r) => r.cuisine).filter((c): c is string => !!c))].sort();
    return (
      <main className="flex flex-col gap-8 pt-8">
        <Intro />
        {(me.profile?.diets?.length ?? 0) > 0 && (
          <p className="text-sm text-muted">
            Following your diet: <b>{me.profile!.diets.map((d) => DIETS[d as keyof typeof DIETS] ?? d).join(", ")}</b>.{" "}
            <Link href="/account" className="underline">
              Change
            </Link>
          </p>
        )}
        <PlanForm
          cuisines={cuisines}
          cookoffDish={challenge && isLive(challenge) ? challenge.recipe.dish : null}
          include={include ? { slug: include.slug, dish: include.dish } : null}
        />
      </main>
    );
  }

  const recipes = await getRecipesByIds(plan.recipe_ids);
  const made = await cookedSince(me.user.id, plan.recipe_ids, plan.created_at);
  const week = summarize(recipes, plan.settings.servings, pantryKeys);
  const missing = plan.settings.dinners - recipes.length;
  const s = plan.settings;

  return (
    <main className="flex flex-col gap-8 pt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="label">Plan my week</span>
          <h1 className="font-display text-4xl font-bold tracking-tight">Your week of dinners</h1>
          <p className="text-muted">
            {s.dinners} dinners for {s.servings} {s.servings === 1 ? "person" : "people"}
            {s.maxMinutes ? ` · ${s.maxMinutes} min or less` : ""}
            {s.cuisines.length ? ` · ${s.cuisines.join(", ")}` : ""}
          </p>
        </div>
        <Link href="/plan?new=1" className="btn btn-ghost btn-sm">
          New plan
        </Link>
      </div>

      <Headline plan={week} servings={s.servings} />

      <Meals
        plan={week}
        actions={(i) => (
          <span className="flex flex-wrap items-center gap-2">
            {made.has(recipes[i]?.id) ? (
              <span className="rounded-lg bg-basil px-2.5 py-1 text-xs font-semibold text-basil-ink">Made ✓</span>
            ) : (
              <AdminButton action={markPlanMealCooked.bind(null, plan.id, i)} label="Made it" className="btn btn-primary btn-sm" cheer />
            )}
            <AdminButton action={swapPlanMeal.bind(null, plan.id, i)} label="Swap" />
            {recipes.length > 1 && <AdminButton action={removePlanMeal.bind(null, plan.id, i)} label="Remove" className="text-xs text-muted underline" />}
          </span>
        )}
      />

      {missing > 0 && (
        <section className="card flex flex-col gap-3 border-dashed p-5">
          <p className="font-display text-lg font-bold">
            Only {recipes.length} {recipes.length === 1 ? "dinner fits" : "dinners fit"} your choices
          </p>
          <p className="text-sm text-muted">
            Dupe Kitchen can write {missing === 1 ? "a new dinner" : `${missing} new dinners`} built on this week&apos;s leftovers. Each one takes about 15 seconds.
          </p>
          <AdminButton action={fillPlanGap.bind(null, plan.id)} label="Add a new recipe" className="btn btn-primary btn-sm w-fit" />
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)] lg:items-start">
        <section className="card flex flex-col gap-3 p-5">
          <div>
            <h2 className="font-display text-2xl font-bold">Shopping list</h2>
            <p className="text-sm text-muted">Everything for the week in one trip. Items marked with a count are shared between dinners.</p>
          </div>
          <GroceryList planId={plan.id} lines={week.groceries} pantry={week.pantryUsed} />
        </section>

        {week.leftovers.length > 0 && (
          <section className="card flex flex-col gap-3 p-5">
            <h2 className="font-display text-xl font-bold">Left at the end of the week</h2>
            <p className="text-sm text-muted">About {money(week.bill - week.used)} of groceries you&apos;ll still have.</p>
            {(["Use soon", "Keeps in the cupboard"] as const).map((group) => {
              const items = week.leftovers.filter((l) => l.perishable === (group === "Use soon"));
              return items.length ? (
                <div key={group}>
                  <h3 className="label mb-1">{group}</h3>
                  <ul className="flex flex-wrap gap-1.5">
                    {items.map((l) => (
                      <li key={l.name} className="rounded-full border border-line px-2.5 py-1 text-xs">
                        {l.name.replace(/,.*$/, "")} · {shareLabel({ share: l.share, measured: true })} left
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null;
            })}
            {week.meals.length > 0 && (
              <Link href={`/r/${week.meals[week.meals.length - 1].recipe.slug}#use-it-up`} className="text-sm font-semibold text-basil underline">
                Find recipes for them
              </Link>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

function Intro() {
  return (
    <div>
      <span className="label">Plan my week</span>
      <h1 className="font-display text-4xl font-bold tracking-tight">Dinners that share their groceries</h1>
      <p className="max-w-[60ch] text-muted">
        Like a restaurant kitchen planning its prep: the cilantro you buy for Monday&apos;s tacos goes into Wednesday&apos;s bowl, so you buy less and throw out less.
      </p>
    </div>
  );
}

function Headline({ plan, servings }: { plan: Plan; servings: number }) {
  if (!plan.meals.length) return null;
  return (
    <section className="grid gap-3 sm:grid-cols-3">
      <div className="card p-5">
        <span className="label">Per plate</span>
        <p className="tabular font-mono text-3xl font-semibold text-basil">{money(plan.perPlate)}</p>
        <p className="text-xs text-muted">
          {plan.meals.length} dinners × {servings} {servings === 1 ? "person" : "people"}
        </p>
      </div>
      <div className="card p-5">
        <span className="label">Shopping bill</span>
        <p className="tabular font-mono text-3xl font-semibold">{money(plan.bill)}</p>
        <p className="text-xs text-muted">{money(plan.used)} gets eaten this week; the rest stays in your kitchen</p>
      </div>
      {plan.outVsHome ? (
        <div className="card border-saffron p-5">
          <span className="label">vs. eating out</span>
          <p className="tabular font-mono text-3xl font-semibold">{money(plan.outVsHome.out)}</p>
          <p className="text-xs text-muted">
            {plan.outVsHome.dishes === plan.meals.length ? "This week" : `${plan.outVsHome.dishes} of these dinners`} cost {money(plan.outVsHome.home)} at home.{" "}
            {plan.outVsHome.copycats === plan.outVsHome.dishes ? "Menu prices." : "Menu prices for copycats, similar takeout for the rest."}
          </p>
        </div>
      ) : (
        <div className="card p-5">
          <span className="label">Shared groceries</span>
          <p className="tabular font-mono text-3xl font-semibold">{plan.groceries.filter((g) => g.usedBy > 1).length}</p>
          <p className="text-xs text-muted">items used in more than one dinner</p>
        </div>
      )}
    </section>
  );
}

function Meals({ plan, actions }: { plan: Plan; actions?: (i: number) => React.ReactNode }) {
  return (
    <ol className="flex flex-col gap-3">
      {plan.meals.map(({ recipe: r, cost, reuses }, i) => (
        <li key={r.id} className="card flex gap-4 p-3 sm:items-center">
          <Link href={`/r/${r.slug}`} className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-sunk sm:size-24">
            {r.image_url ? (
              <Image src={r.image_url} alt="" fill sizes="96px" className="object-cover" />
            ) : (
              <span className="grid h-full place-items-center font-display text-2xl text-muted" aria-hidden>
                {r.dish.slice(0, 1)}
              </span>
            )}
          </Link>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="label">
              {WEEKDAYS[i] ?? `Dinner ${i + 1}`}
              {recipeLabel(r) ? ` · ${recipeLabel(r)}` : ""}
            </span>
            <Link href={`/r/${r.slug}`} className="font-display text-lg font-bold leading-tight hover:text-basil">
              {r.dish}
            </Link>
            <span className="tabular font-mono text-xs text-muted">
              {r.minutes ? `${r.minutes} min · ` : ""}
              {money(cost)} for the meal
            </span>
            {reuses.length > 0 && (
              <span className="text-xs text-basil">Reuses {reuses.map((n) => n.replace(/,.*$/, "").toLowerCase()).join(", ")}</span>
            )}
          </div>
          {actions && <div className="shrink-0">{actions(i)}</div>}
        </li>
      ))}
    </ol>
  );
}
