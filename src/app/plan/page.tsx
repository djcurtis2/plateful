import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getCurrentChallenge, getLatestPlan, getMe, getPantry, getRecipeBySlug, getRecipesByIds, getSuggestionPool, isLive } from "@/lib/data";
import { pantryKey, money } from "@/lib/format";
import { PLAN_MEALS, PLAN_MEAL_LABELS, eligible, planWeek, slotIds, summarizeWeek, WEEKDAYS, type Plan, type PlannedMeal } from "@/lib/planner";
import { recipeLabel } from "@/lib/recipe";
import { shareLabel } from "@/lib/leftovers";
import { PlanForm } from "@/components/PlanForm";
import { DIETS } from "@/lib/diet";
import { refreshFromStripe } from "@/lib/billing";
import { GroceryList } from "@/components/GroceryList";
import { AdminButton } from "@/components/AdminButton";
import { clearPlanSlot, fillPlanGap, markPlanMealCooked, swapPlanMeal } from "./actions";
import { cookedSince } from "@/lib/savings-server";

export const metadata: Metadata = { title: "Plan my week" };
export const dynamic = "force-dynamic";

type Search = { searchParams: Promise<{ new?: string; include?: string }> };

export default async function PlanPage({ searchParams }: Search) {
  const sp = await searchParams;
  let me = await getMe();
  if (me && !me.plus && me.profile?.stripe_customer_id && (await refreshFromStripe(me.user.id, me.profile.stripe_customer_id))) me = await getMe({ fresh: true });
  if (!me) redirect(`/login?next=${encodeURIComponent(`/plan${sp.include ? `?new=1&include=${sp.include}` : ""}`)}`);

  const [pool, pantry] = await Promise.all([getSuggestionPool(me.user.id, 400), getPantry(me.user.id)]);
  const pantryKeys = pantry.map(pantryKey);

  // Free accounts: a real example week, with the parts that make it useful behind Plus.
  if (!me.plus) {
    const s = { days: 3, meals: [...PLAN_MEALS], servings: 2, maxMinutes: null, cuisines: [], diets: me.profile?.diets ?? [] };
    const example = summarizeWeek(planWeek(pool, s, pantryKeys), new Map(pool.map((r) => [r.id, r])), 2, pantryKeys);
    return (
      <main className="flex flex-col gap-8 pt-8">
        <Intro />
        <section className="card flex flex-col gap-4 border-saffron p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="label">Yumjack Plus</span>
            <p className="font-display text-2xl font-bold">Plan every meal of the week, snacks included</p>
            <p className="text-muted">Pick it all yourself or let us fill it in. One shopping list, nothing wasted. Here are three example days.</p>
          </div>
          <Link href="/pricing" className="btn btn-sun shrink-0">
            Get Plus
          </Link>
        </section>
        <Headline plan={example} servings={2} />
        <Week plan={example} />
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
    const base = { servings: 2, maxMinutes: null, cuisines: [], diets: me.profile?.diets ?? [] };
    const cuisines = [...new Set([...eligible(pool, base, "dinner"), ...eligible(pool, base, "lunch")].map((r) => r.cuisine).filter((c): c is string => !!c))].sort();
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

  const recipes = await getRecipesByIds(slotIds(plan.slots));
  const week = summarizeWeek(plan.slots, new Map(recipes.map((r) => [r.id, r])), plan.settings.servings, pantryKeys);
  // Older dinner-only plans didn't store "Made it" per spot; read it from the cooking log instead.
  const cooked = plan.legacy ? await cookedSince(me.user.id, slotIds(plan.slots), plan.created_at) : new Set<string>();
  const made = (m: PlannedMeal) => !!m.slot.made || (!!m.slot.id && cooked.has(m.slot.id));
  const open = week.meals.filter((m) => !m.recipe).length;
  const s = plan.settings;

  return (
    <main className="flex flex-col gap-8 pt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="label">Plan my week</span>
          <h1 className="font-display text-4xl font-bold tracking-tight">Your week</h1>
          <p className="text-muted">
            {s.days} days · {s.meals.map((m) => PLAN_MEAL_LABELS[m].toLowerCase()).join(", ")} · {s.servings} {s.servings === 1 ? "person" : "people"}
            {s.maxMinutes ? ` · ${s.maxMinutes} min or less` : ""}
            {s.cuisines.length ? ` · ${s.cuisines.join(", ")}` : ""}
          </p>
        </div>
        <span className="flex flex-wrap gap-2">
          <Link href="/library/new" className="btn btn-ghost btn-sm">
            Add my own recipe
          </Link>
          <Link href="/plan?new=1" className="btn btn-ghost btn-sm">
            New plan
          </Link>
        </span>
      </div>

      <Headline plan={week} servings={s.servings} />

      {open > 0 && (
        <p className="rounded-2xl bg-sunk px-4 py-3 text-sm">
          <b>
            {open} open {open === 1 ? "spot" : "spots"}.
          </b>{" "}
          Pick any recipe (yours or anyone&apos;s), let us choose with Swap, have Yumjack write a new one, or leave it open for a night out.
        </p>
      )}

      <Week
        plan={week}
        actions={(m, i) => {
          if (!m.recipe)
            return (
              <span className="flex flex-wrap items-center gap-2">
                <Link href={`/plan/pick?slot=${i}`} className="btn btn-primary btn-sm">
                  Pick a recipe
                </Link>
                <AdminButton action={swapPlanMeal.bind(null, plan.id, i)} label="Choose for me" />
                <AdminButton action={fillPlanGap.bind(null, plan.id, i)} label="Write a new one" className="text-xs text-muted underline" />
              </span>
            );
          const cookedAt = m.leftoverFrom !== undefined ? week.meals[m.leftoverFrom] : m;
          return (
            <span className="flex flex-wrap items-center gap-2">
              {made(cookedAt) ? (
                <span className="rounded-lg bg-basil px-2.5 py-1 text-xs font-semibold text-basil-ink">Made ✓</span>
              ) : m.leftoverFrom === undefined ? (
                <AdminButton action={markPlanMealCooked.bind(null, plan.id, i)} label="Made it" className="btn btn-primary btn-sm" cheer />
              ) : null}
              <AdminButton action={swapPlanMeal.bind(null, plan.id, i)} label="Swap" />
              <Link href={`/plan/pick?slot=${i}`} className="btn btn-ghost btn-sm">
                Change
              </Link>
              <AdminButton action={clearPlanSlot.bind(null, plan.id, i)} label="Clear" className="text-xs text-muted underline" />
            </span>
          );
        }}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)] lg:items-start">
        <section className="card flex flex-col gap-3 p-5">
          <div>
            <h2 className="font-display text-2xl font-bold">Shopping list</h2>
            <p className="text-sm text-muted">Everything for the week in one trip. Items marked with a count are shared between meals.</p>
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
            {(() => {
              const last = [...week.meals].reverse().find((m) => m.recipe && m.recipe.source !== "own");
              return last?.recipe ? (
                <Link href={`/r/${last.recipe.slug}#use-it-up`} className="text-sm font-semibold text-basil underline">
                  Find recipes for them
                </Link>
              ) : null;
            })()}
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
      <h1 className="font-display text-4xl font-bold tracking-tight">A week of meals that share their groceries</h1>
      <p className="max-w-[60ch] text-muted">
        Like a restaurant kitchen planning its prep: the cilantro you buy for Monday&apos;s tacos goes into Wednesday&apos;s bowl, and tonight&apos;s
        dinner is tomorrow&apos;s lunch. Breakfast, lunch, dinner and snacks, from our recipes or your own.
      </p>
    </div>
  );
}

function Headline({ plan, servings }: { plan: Plan; servings: number }) {
  const filled = plan.meals.filter((m) => m.recipe).length;
  if (!filled) return null;
  return (
    <section className="grid gap-3 sm:grid-cols-3">
      <div className="card p-5">
        <span className="label">Per plate</span>
        <p className="tabular font-mono text-3xl font-semibold text-basil">{money(plan.perPlate)}</p>
        <p className="text-xs text-muted">
          {filled} {filled === 1 ? "meal" : "meals"} × {servings} {servings === 1 ? "person" : "people"}
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
            {plan.outVsHome.dishes === filled ? "This week" : `${plan.outVsHome.dishes} of these meals`} cost {money(plan.outVsHome.home)} at home.{" "}
            {plan.outVsHome.copycats === plan.outVsHome.dishes ? "Menu prices." : "Menu prices for copycats, similar takeout for the rest."} Estimates.
          </p>
        </div>
      ) : (
        <div className="card p-5">
          <span className="label">Shared groceries</span>
          <p className="tabular font-mono text-3xl font-semibold">{plan.groceries.filter((g) => g.usedBy > 1).length}</p>
          <p className="text-xs text-muted">items used in more than one meal</p>
        </div>
      )}
    </section>
  );
}

/** The week, one card per day, a row per meal. */
function Week({ plan, actions }: { plan: Plan; actions?: (m: PlannedMeal, i: number) => React.ReactNode }) {
  const days = [...new Set(plan.meals.map((m) => m.slot.day))];
  return (
    <ol className="flex flex-col gap-4">
      {days.map((day) => (
        <li key={day} className="card flex flex-col p-3 sm:p-4">
          <h2 className="px-1 pb-2 font-display text-xl font-bold">{WEEKDAYS[day] ?? `Day ${day + 1}`}</h2>
          <ul className="flex flex-col divide-y divide-line">
            {plan.meals.map((m, i) => (m.slot.day === day ? <MealRow key={i} m={m} plan={plan} actions={actions?.(m, i)} /> : null))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

function MealRow({ m, plan, actions }: { m: PlannedMeal; plan: Plan; actions?: React.ReactNode }) {
  const r = m.recipe;
  const meal = PLAN_MEAL_LABELS[m.slot.meal];
  const from = m.leftoverFrom !== undefined ? plan.meals[m.leftoverFrom] : null;
  const feeds = plan.meals.find((x) => x.leftoverFrom !== undefined && plan.meals[x.leftoverFrom] === m);
  return (
    <li className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 gap-3">
        {r ? (
          <Link href={`/r/${r.slug}`} className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-sunk sm:size-16">
            {r.image_url ? (
              <Image src={r.image_url} alt="" fill sizes="64px" className="object-cover" />
            ) : (
              <span className="grid h-full place-items-center font-display text-xl text-muted" aria-hidden>
                {r.dish.slice(0, 1)}
              </span>
            )}
          </Link>
        ) : (
          <span className="grid size-14 shrink-0 place-items-center rounded-xl border-2 border-dashed border-line text-xl text-muted sm:size-16" aria-hidden>
            +
          </span>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="label">
            {meal}
            {from ? " · Leftovers" : r && recipeLabel(r) ? ` · ${recipeLabel(r)}` : ""}
          </span>
          {r ? (
            <Link href={`/r/${r.slug}`} className="font-display text-lg font-bold leading-tight hover:text-basil">
              {r.dish}
            </Link>
          ) : (
            <span className="font-display text-lg font-bold leading-tight text-muted">Open</span>
          )}
          {r && (
            <span className="tabular font-mono text-xs text-muted">
              {from ? `From ${WEEKDAYS[from.slot.day]}'s ${PLAN_MEAL_LABELS[from.slot.meal].toLowerCase()} · ` : r.minutes ? `${r.minutes} min · ` : ""}
              {money(m.cost)} for the meal
            </span>
          )}
          {feeds && <span className="text-xs font-semibold">Cook double: {WEEKDAYS[feeds.slot.day]}&apos;s lunch is leftovers</span>}
          {m.reuses.length > 0 && <span className="text-xs text-basil">Reuses {m.reuses.map((n) => n.replace(/,.*$/, "").toLowerCase()).join(", ")}</span>}
        </div>
      </div>
      {actions && <div className="shrink-0 sm:max-w-[50%]">{actions}</div>}
    </li>
  );
}
