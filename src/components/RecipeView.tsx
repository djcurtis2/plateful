"use client";
import { DietChips } from "@/components/DietChips";
import { celebrate, earnedText, here } from "@/lib/celebrate";
import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Recipe } from "@/lib/recipe";
import { menuPlate, recipeLabel, savings } from "@/lib/recipe";
import { formatQty, money, packagesNeeded, pantryKey } from "@/lib/format";
import { STORES, STORE_IDS, type StoreId } from "@/lib/stores";
import { markCooked, toggleSave, updatePantry } from "@/app/actions";
import { ShareCard } from "@/components/ShareCard";

type Props = {
  recipe: Recipe;
  shareUrl: string;
  signedIn: boolean;
  pantry: string[];
  initiallySaved: boolean;
  initiallyCooked: boolean;
  hasEntry?: boolean;
  myDiets?: string[];
  versionOf?: { slug: string; dish: string; label: string } | null;
};

export function RecipeView({ recipe, shareUrl, signedIn, pantry, initiallySaved, initiallyCooked, hasEntry = false, myDiets = [], versionOf = null }: Props) {
  const [servings, setServings] = useState(recipe.servings);
  const pantrySet = useMemo(() => new Set(pantry), [pantry]);
  const [have, setHave] = useState<Set<number>>(
    () => new Set(recipe.ingredients.flatMap((g, i) => (pantrySet.has(pantryKey(g.name)) ? [i] : []))),
  );
  const [store, setStore] = useState<StoreId>("instacart");
  const [saved, setSaved] = useState(initiallySaved);
  const [cooked, setCooked] = useState(initiallyCooked);
  const [notice, setNotice] = useState("");
  const [pending, start] = useTransition();

  const scale = servings / recipe.servings;
  const s = savings(recipe);
  const items = recipe.ingredients
    .map((g, i) => ({ ...g, i, cost: g.price * packagesNeeded(scale) }))
    .filter((g) => !have.has(g.i));
  const total = items.reduce((a, g) => a + g.cost, 0);
  const byAisle = items.reduce<Record<string, typeof items>>((acc, g) => {
    (acc[g.aisle] ??= []).push(g);
    return acc;
  }, {});

  function toggleHave(i: number, checked: boolean) {
    const next = new Set(have);
    if (checked) next.add(i);
    else next.delete(i);
    setHave(next);
    if (signedIn) {
      const name = recipe.ingredients[i].name;
      start(async () => {
        await updatePantry(checked ? [name] : [], checked ? [] : [name]);
      });
    }
  }

  function save() {
    if (!signedIn) return setNotice("login");
    start(async () => {
      const r = await toggleSave(recipe.id, !saved);
      if (r.ok) setSaved(!saved);
      else setNotice(r.message);
    });
  }

  function cook(after?: () => void) {
    if (!signedIn) {
      after?.();
      return;
    }
    const at = here();
    start(async () => {
      const r = await markCooked(recipe.id, servings);
      if (r.ok) {
        setCooked(true);
        setSaved(true);
        celebrate({ text: earnedText(undefined, r.saved) ?? "Nice cooking!", origin: at });
        if (r.saved) setNotice(`saved:${r.saved}`);
      }
      after?.();
    });
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)]">
      <article className="flex min-w-0 flex-col gap-8">
        <header className="flex flex-col gap-4">
          {recipe.image_url && (
            <div className="relative aspect-[16/10] overflow-hidden rounded-3xl bg-sunk">
              <Image src={recipe.image_url} alt={recipe.dish} fill priority sizes="(max-width: 1024px) 100vw, 640px" className="object-cover" />
            </div>
          )}
          <div className="flex flex-col gap-2">
            {recipeLabel(recipe) && (
              <span className="label">
                {recipeLabel(recipe)}
                {versionOf ? ` · ${versionOf.label} version` : ""}
              </span>
            )}
            <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">{recipe.dish}</h1>
            {versionOf && (
              <p className="text-sm text-muted">
                A {versionOf.label.toLowerCase()} version of{" "}
                <Link href={`/r/${versionOf.slug}`} className="font-semibold text-basil underline">
                  {versionOf.dish}
                </Link>
              </p>
            )}
            <DietChips recipe={recipe} myDiets={myDiets} />
            <div className="flex flex-wrap gap-2 font-mono text-xs">
              {recipe.confidence != null && (
                <span className="rounded-lg bg-sunk px-2 py-1 text-basil">{Math.round(recipe.confidence * 100)}% match</span>
              )}
              {recipe.cuisine && <span className="rounded-lg bg-sunk px-2 py-1">{recipe.cuisine}</span>}
              {recipe.minutes && <span className="rounded-lg bg-sunk px-2 py-1">{recipe.minutes} min</span>}
              {recipe.difficulty && <span className="rounded-lg bg-sunk px-2 py-1">{recipe.difficulty}</span>}
            </div>
          </div>
          {(recipe.menu_price || recipe.plate_cost) && (
            <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-4 rounded-2xl bg-sunk px-5 py-4">
              {recipe.menu_price ? (
                <div>
                  <span className="label">{recipe.restaurant ?? "Restaurant"}{recipe.menu_serves > 1 ? ", per plate" : ""}</span>
                  <b className="tabular block font-mono text-2xl">{money(menuPlate(recipe))}</b>
                  {recipe.menu_serves > 1 && (
                    <span className="text-xs text-muted">
                      {money(recipe.menu_price)} order serves {recipe.menu_serves}
                    </span>
                  )}
                </div>
              ) : recipe.out_price ? (
                <div>
                  <span className="label">Similar takeout</span>
                  <b className="tabular block font-mono text-2xl">~{money(recipe.out_price)}</b>
                </div>
              ) : (
                <span />
              )}
              <div>
                <span className="label">Home, per plate</span>
                <b className="tabular block font-mono text-2xl text-basil">{money(recipe.plate_cost)}</b>
              </div>
              {s && <span className="rounded-lg bg-saffron px-2.5 py-1.5 font-mono text-sm font-semibold text-saffron-ink">{s.pct}% less</span>}
            </div>
          )}
          {recipe.why && <p className="border-l-[3px] border-saffron pl-3 text-sm text-muted">{recipe.why}</p>}
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-ghost btn-sm" onClick={save} disabled={pending}>
              {saved ? "Saved to My recipes" : "Save recipe"}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => (signedIn ? cook() : setNotice("login"))} disabled={pending || cooked}>
              {cooked ? "You made this" : "I made it"}
            </button>
          </div>
          {notice === "login" ? (
            <p className="text-sm text-muted">
              <Link className="font-semibold text-basil underline" href={`/login?next=/r/${recipe.slug}`}>
                Sign in free
              </Link>{" "}
              to save recipes, remember your pantry and post to the cook-off.
            </p>
          ) : notice.startsWith("saved:") ? (
            <p className="rounded-2xl bg-basil px-4 py-2 text-sm font-semibold text-basil-ink" role="status">
              Nice! You saved ${Number(notice.slice(6)).toFixed(2)} vs. eating out.{" "}
              <Link href="/account#savings" className="underline">
                See your total
              </Link>
            </p>
          ) : notice ? (
            <p role="alert" className="text-sm text-chili">
              {notice}
            </p>
          ) : null}
        </header>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4 rounded-2xl bg-sunk py-2 pl-4 pr-2">
            <span className="font-semibold">Servings</span>
            <div className="flex items-center gap-2">
              <button className="size-9 rounded-xl border border-line bg-surface font-semibold" aria-label="Fewer servings" onClick={() => setServings((n) => Math.max(1, n - 1))}>
                −
              </button>
              <output className="tabular w-7 text-center font-mono" aria-live="polite">
                {servings}
              </output>
              <button className="size-9 rounded-xl border border-line bg-surface font-semibold" aria-label="More servings" onClick={() => setServings((n) => Math.min(12, n + 1))}>
                +
              </button>
            </div>
          </div>
          <h2 className="label pt-2">Ingredients · tick what you already have</h2>
          <ul className="flex flex-col">
            {recipe.ingredients.map((g, i) => (
              <li key={i} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-line py-2.5">
                <input
                  id={`have-${i}`}
                  type="checkbox"
                  className="size-[18px] accent-[var(--basil)]"
                  checked={have.has(i)}
                  onChange={(e) => toggleHave(i, e.target.checked)}
                />
                <label htmlFor={`have-${i}`} className={have.has(i) ? "text-muted line-through" : ""}>
                  {g.name}
                </label>
                <span className="tabular whitespace-nowrap font-mono text-sm text-muted">{formatQty(g.qty * scale, g.unit)}</span>
              </li>
            ))}
          </ul>
          {signedIn && <p className="text-xs text-muted">Ticked items are remembered in your pantry for next time.</p>}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="label">Method</h2>
          <ol className="flex list-decimal flex-col gap-3 pl-5 marker:font-mono marker:text-basil">
            {recipe.steps.map((step, i) => (
              <li key={i} className="pl-1">
                {step}
              </li>
            ))}
          </ol>
        </section>
      </article>

      <aside className="flex min-w-0 flex-col gap-8 lg:sticky lg:top-20 lg:self-start">
        <section className="card flex flex-col gap-4 p-5">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-display text-2xl font-bold">Your cart</h2>
            <span className="text-sm text-muted">{items.length} items</span>
          </div>
          <div role="group" aria-label="Store" className="grid grid-cols-3 gap-1 rounded-xl bg-sunk p-1">
            {STORE_IDS.map((id) => (
              <button
                key={id}
                aria-pressed={store === id}
                onClick={() => setStore(id)}
                className={`rounded-lg px-2 py-2 text-sm font-semibold ${store === id ? "bg-surface text-ink shadow-sm" : "text-muted"}`}
              >
                {STORES[id].name}
              </button>
            ))}
          </div>
          {items.length === 0 ? (
            <p className="py-6 text-center text-muted">You have everything. Go cook.</p>
          ) : (
            <div className="flex flex-col">
              {Object.entries(byAisle).map(([aisle, gs]) => (
                <div key={aisle} className="flex flex-col">
                  <h3 className="label mt-2">{aisle}</h3>
                  {gs.map((g) => (
                    <div key={g.i} className="flex items-center justify-between gap-3 border-b border-line py-2">
                      <a
                        href={STORES[store].searchUrl(g.name)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => cook()}
                        className="min-w-0 break-words hover:text-basil hover:underline"
                      >
                        {g.name}
                      </a>
                      <span className="tabular font-mono text-sm">{g.cost ? money(g.cost) : "—"}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
          <div className="flex items-baseline justify-between">
            <span className="label">Estimated total</span>
            <b className="tabular font-mono text-2xl">{money(total)}</b>
          </div>
          <p className="text-xs text-muted">
            Tap an item to find it at {STORES[store].name}. Prices are estimates and vary by store.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <div>
            <h2 className="font-display text-2xl font-bold">{recipe.restaurant ? "Restaurant vs. mine" : "Show off your version"}</h2>
            <p className="text-sm text-muted">Add a photo of your version and post it. Your link earns you free months.</p>
          </div>
          <ShareCard recipe={recipe} shareUrl={shareUrl} canPost={signedIn} hasEntry={hasEntry} />
        </section>
      </aside>
    </div>
  );
}
