"use client";
import { DIETS, DIET_IDS, fitsDiets, type Diet } from "@/lib/diet";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RecipeTile } from "@/components/RecipeTile";
import { MEALS, MEAL_LABELS, savings, type Meal, type Recipe } from "@/lib/recipe";

type Item = { recipe: Recipe; cookedAt: string | null; savedAt: string };

const SORTS = {
  recent: "Recently saved",
  savings: "Biggest savings",
  cheapest: "Cheapest per plate",
  quickest: "Quickest",
  az: "A to Z",
} as const;
type Sort = keyof typeof SORTS;

const nullsLast = (a: number | null, b: number | null) => (a == null ? 1 : b == null ? -1 : a - b);

/** Search, filter (meal, cuisine, restaurant, made it) and sort your saved recipes. Choices are kept in the URL. */
export function LibraryBrowser({ items, myDiets = [] }: { items: Item[]; myDiets?: string[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [meal, setMeal] = useState<Meal | "">((MEALS as readonly string[]).includes(params.get("meal") ?? "") ? (params.get("meal") as Meal) : "");
  const [cuisine, setCuisine] = useState(params.get("cuisine") ?? "");
  const [restaurant, setRestaurant] = useState(params.get("restaurant") ?? "");
  const [made, setMade] = useState<"" | "yes" | "no">(params.get("made") === "yes" ? "yes" : params.get("made") === "no" ? "no" : "");
  const [diet, setDiet] = useState(params.get("diet") ?? "");
  const [sort, setSort] = useState<Sort>((params.get("sort") as Sort) in SORTS ? (params.get("sort") as Sort) : "recent");

  // Keep the URL in step so a refresh or the back button keeps your filters.
  useEffect(() => {
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    if (meal) p.set("meal", meal);
    if (cuisine) p.set("cuisine", cuisine);
    if (restaurant) p.set("restaurant", restaurant);
    if (made) p.set("made", made);
    if (diet) p.set("diet", diet);
    if (sort !== "recent") p.set("sort", sort);
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [q, meal, cuisine, restaurant, made, diet, sort, pathname, router]);

  const cuisines = useMemo(() => [...new Set(items.map((i) => i.recipe.cuisine).filter((c): c is string => !!c))].sort(), [items]);
  const restaurants = useMemo(() => [...new Set(items.map((i) => i.recipe.restaurant).filter((r): r is string => !!r))].sort(), [items]);
  const mealCounts = useMemo(() => {
    const c = Object.fromEntries(MEALS.map((m) => [m, 0])) as Record<Meal, number>;
    for (const i of items) for (const m of i.recipe.meals) c[m]++;
    return c;
  }, [items]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = items.filter(({ recipe: r, cookedAt }) => {
      if (meal && !r.meals.includes(meal)) return false;
      if (cuisine && r.cuisine !== cuisine) return false;
      if (restaurant && r.restaurant !== restaurant) return false;
      if (made === "yes" && !cookedAt) return false;
      if (made === "no" && cookedAt) return false;
      if (diet === "mine" && !fitsDiets(r, myDiets)) return false;
      if (diet && diet !== "mine" && !r.diet_tags.includes(diet as Diet)) return false;
      if (needle) {
        const hay = [r.dish, r.restaurant, r.cuisine, ...r.ingredients.map((g) => g.name)].join(" ").toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    return list.sort((a, b) => {
      const x = a.recipe;
      const y = b.recipe;
      switch (sort) {
        case "savings":
          return (savings(y)?.saved ?? -1) - (savings(x)?.saved ?? -1);
        case "cheapest":
          return nullsLast(x.plate_cost, y.plate_cost);
        case "quickest":
          return nullsLast(x.minutes, y.minutes);
        case "az":
          return x.dish.localeCompare(y.dish);
        default:
          return b.savedAt.localeCompare(a.savedAt);
      }
    });
  }, [items, q, meal, cuisine, restaurant, made, diet, myDiets, sort]);

  const filtered = !!(q.trim() || meal || cuisine || restaurant || made || diet);
  const clear = () => {
    setQ("");
    setMeal("");
    setCuisine("");
    setRestaurant("");
    setMade("");
    setDiet("");
  };
  const chip = (active: boolean) =>
    `shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${active ? "border-basil bg-basil text-basil-ink" : "border-line bg-surface text-ink hover:border-basil"}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="card flex flex-col gap-3 p-3 sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search your recipes</span>
            <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input value={q} onChange={(e) => setQ(e.target.value)} className="input w-full pl-9" placeholder="Search dishes, restaurants or ingredients" type="search" />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <span className="label shrink-0">Sort</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="input py-2">
              {(Object.keys(SORTS) as Sort[]).map((k) => (
                <option key={k} value={k}>
                  {SORTS[k]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div role="group" aria-label="Meal" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <button className={chip(!meal)} aria-pressed={!meal} onClick={() => setMeal("")}>
            All meals
          </button>
          {MEALS.filter((m) => mealCounts[m] > 0 || meal === m).map((m) => (
            <button key={m} className={chip(meal === m)} aria-pressed={meal === m} onClick={() => setMeal(meal === m ? "" : m)}>
              {MEAL_LABELS[m]} <span className="tabular font-mono text-xs opacity-70">{mealCounts[m]}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          {cuisines.length > 0 && (
            <select value={cuisine} onChange={(e) => setCuisine(e.target.value)} className="input py-2" aria-label="Cuisine">
              <option value="">Any cuisine</option>
              {cuisines.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
          {restaurants.length > 0 && (
            <select value={restaurant} onChange={(e) => setRestaurant(e.target.value)} className="input py-2" aria-label="Restaurant">
              <option value="">Any restaurant</option>
              {restaurants.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          )}
          <select value={diet} onChange={(e) => setDiet(e.target.value)} className="input py-2" aria-label="Diet">
            <option value="">Any diet</option>
            {myDiets.length > 0 && <option value="mine">Fits my diet</option>}
            {DIET_IDS.map((d) => (
              <option key={d} value={d}>
                {DIETS[d]}
              </option>
            ))}
          </select>
          <select value={made} onChange={(e) => setMade(e.target.value as "" | "yes" | "no")} className="input py-2" aria-label="Made it">
            <option value="">Made it or not</option>
            <option value="yes">Made it</option>
            <option value="no">Not made yet</option>
          </select>
          {filtered && (
            <button onClick={clear} className="text-sm font-semibold text-basil underline">
              Clear filters
            </button>
          )}
          <span className="ml-auto text-xs text-muted" aria-live="polite">
            {shown.length} of {items.length}
          </span>
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 p-8 text-center">
          <p className="font-display text-lg font-bold">Nothing matches</p>
          <button onClick={clear} className="btn btn-ghost btn-sm">
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map(({ recipe, cookedAt }) => (
            <RecipeTile key={recipe.id} recipe={recipe} note={cookedAt ? "made it" : undefined} />
          ))}
        </div>
      )}
    </div>
  );
}
