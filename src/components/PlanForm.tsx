"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPlan } from "@/app/plan/actions";

const MEALS = [
  ["breakfast", "Breakfast"],
  ["lunch", "Lunch"],
  ["dinner", "Dinner"],
  ["snack", "Snacks"],
] as const;

/** Settings for a new week: how many days and which meals, for how many people, optional limits and must-haves. */
export function PlanForm({ cuisines, cookoffDish, include }: { cuisines: string[]; cookoffDish: string | null; include: { slug: string; dish: string } | null }) {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <form
      className="card flex flex-col gap-5 p-5 sm:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const r = await createPlan(fd);
          if (r.ok) router.replace("/plan");
          else setError(r.message);
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="label">Days</span>
          <select name="days" defaultValue="7" className="input">
            {[3, 4, 5, 6, 7].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="label">People</span>
          <select name="servings" defaultValue="2" className="input">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="label">Time per meal</span>
          <select name="maxMinutes" defaultValue="" className="input">
            <option value="">Any</option>
            <option value="30">30 min or less</option>
            <option value="45">45 min or less</option>
            <option value="60">1 hour or less</option>
          </select>
        </label>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="label mb-1">Meals each day</legend>
        <div className="flex flex-wrap gap-2">
          {MEALS.map(([id, label]) => (
            <label key={id} className="cursor-pointer">
              <input type="checkbox" name="meals" value={id} defaultChecked className="peer sr-only" />
              <span className="inline-block rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-semibold peer-checked:border-basil peer-checked:bg-basil peer-checked:text-basil-ink peer-focus-visible:ring-2 peer-focus-visible:ring-basil">
                {label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="label mb-1">Fill it in</legend>
        <label className="flex items-start gap-2 text-sm">
          <input type="radio" name="fill" value="auto" defaultChecked className="mt-1 size-4 accent-[var(--basil)]" />
          <span>
            <b>Plan it for me.</b> Meals that share groceries; tonight&apos;s dinner can be tomorrow&apos;s lunch, and breakfasts and snacks repeat a few
            favorites. You can change any of it.
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="radio" name="fill" value="empty" className="mt-1 size-4 accent-[var(--basil)]" />
          <span>
            <b>I&apos;ll pick everything.</b> Start with an empty week and choose each meal from your own recipes or ours.
          </span>
        </label>
      </fieldset>

      {cuisines.length > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="label mb-1">Cuisines for lunches and dinners (leave blank for any)</legend>
          <div className="flex flex-wrap gap-2">
            {cuisines.map((c) => (
              <label key={c} className="cursor-pointer">
                <input type="checkbox" name="cuisines" value={c} className="peer sr-only" />
                <span className="inline-block rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-semibold peer-checked:border-basil peer-checked:bg-basil peer-checked:text-basil-ink peer-focus-visible:ring-2 peer-focus-visible:ring-basil">
                  {c}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {(cookoffDish || include) && (
        <div className="flex flex-col gap-2 text-sm">
          {include && (
            <p className="rounded-2xl bg-sunk px-4 py-2">
              Building the week around <b>{include.dish}</b>.
              <input type="hidden" name="include" value={include.slug} />
            </p>
          )}
          {cookoffDish && (
            <label className="flex items-center gap-2">
              <input type="checkbox" name="includeCookoff" defaultChecked className="size-4 accent-[var(--basil)]" />
              Include this week&apos;s cook-off dish: <b>{cookoffDish}</b>
            </label>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-chili">
          {error}
        </p>
      )}
      <button className="btn btn-primary w-fit" disabled={pending}>
        {pending ? "Planning your week…" : "Plan my week"}
      </button>
    </form>
  );
}
