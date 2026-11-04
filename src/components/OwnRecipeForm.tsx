"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addOwnRecipe } from "@/app/actions";

const MEAL_CHOICES = [
  ["breakfast", "Breakfast"],
  ["lunch", "Lunch"],
  ["dinner", "Dinner"],
  ["snack", "Snack"],
  ["dessert", "Dessert"],
] as const;

/** Type your own recipe; Yumjack prices it so it can go on a week's shopping list. */
export function OwnRecipeForm({ next, meal }: { next: string | null; meal: string | null }) {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <form
      className="card flex flex-col gap-5 p-5 sm:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError("");
        start(async () => {
          const r = await addOwnRecipe(fd);
          if (r.ok) router.push(next ?? `/r/${r.slug}`);
          else setError(r.message);
        });
      }}
    >
      <label className="flex flex-col gap-1">
        <span className="label">Recipe name</span>
        <input name="dish" required maxLength={90} placeholder="Mom's chicken soup" className="input" />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="label mb-1">Good for</legend>
        <div className="flex flex-wrap gap-2">
          {MEAL_CHOICES.map(([id, label]) => (
            <label key={id} className="cursor-pointer">
              <input type="checkbox" name="meals" value={id} defaultChecked={id === (meal ?? "dinner")} className="peer sr-only" />
              <span className="inline-block rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-semibold peer-checked:border-basil peer-checked:bg-basil peer-checked:text-basil-ink peer-focus-visible:ring-2 peer-focus-visible:ring-basil">
                {label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="label">Serves</span>
          <select name="servings" defaultValue="4" className="input">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="label">Minutes (optional)</span>
          <input name="minutes" type="number" min={1} max={1440} inputMode="numeric" placeholder="45" className="input" />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="label">Ingredients, one per line</span>
        <textarea
          name="ingredients"
          required
          rows={8}
          className="input font-mono text-sm"
          placeholder={"1 whole chicken\n3 carrots\n2 celery stalks\n1 onion\n8 oz egg noodles\nsalt and pepper"}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="label">Steps, one per line (optional)</span>
        <textarea name="steps" rows={5} className="input text-sm" placeholder="Leave blank and we'll write short steps from your ingredients." />
      </label>

      <p className="text-sm text-muted">
        Only you can see your own recipes. We add grocery prices so they work in your shopping list and Plan my week. Prices are estimates.
      </p>
      {error && (
        <p role="alert" className="text-sm text-chili">
          {error}
        </p>
      )}
      <button className="btn btn-primary w-fit" disabled={pending}>
        {pending ? "Pricing your recipe… (about 15 seconds)" : "Save my recipe"}
      </button>
    </form>
  );
}
