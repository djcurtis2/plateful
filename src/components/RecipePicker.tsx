"use client";
import Image from "next/image";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setPlanSlot } from "@/app/plan/actions";
import { money } from "@/lib/format";

export type PickItem = {
  id: string;
  dish: string;
  label: string | null;
  image: string | null;
  minutes: number | null;
  plate: number | null;
  /** In your library (saved, made, or your own). */
  mine: boolean;
  own: boolean;
  /** Tagged for this meal. */
  fits: boolean;
  offDiet: boolean;
};

const SHOW = 60;

/** Search and pick a recipe for one spot in the week. Your recipes first, then everything else. */
export function RecipePicker({
  planId,
  index,
  meal,
  current,
  leftover,
  items,
}: {
  planId: string;
  index: number;
  meal: string;
  current: string | null;
  leftover: { dish: string; day: string } | null;
  items: PickItem[];
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [onlyMeal, setOnlyMeal] = useState(items.some((x) => x.fits));
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return items.filter(
      (x) => (!onlyMeal || x.fits) && words.every((w) => x.dish.toLowerCase().includes(w) || (x.label ?? "").toLowerCase().includes(w)),
    );
  }, [items, q, onlyMeal]);
  const mine = shown.filter((x) => x.mine).sort((a, b) => Number(b.own) - Number(a.own));
  const rest = shown.filter((x) => !x.mine);

  function choose(choice: string | null) {
    setError("");
    setBusy(choice ?? "clear");
    start(async () => {
      const r = await setPlanSlot(planId, index, choice);
      if (r.ok) router.push("/plan");
      else {
        setError(r.message);
        setBusy(null);
      }
    });
  }

  const row = (x: PickItem) => (
    <li key={x.id}>
      <button
        type="button"
        disabled={pending}
        onClick={() => choose(x.id)}
        className={`flex w-full items-center gap-3 rounded-xl border-2 p-2 text-left transition hover:border-basil disabled:opacity-60 ${x.id === current ? "border-basil bg-basil/10" : "border-line bg-surface"}`}
      >
        <span className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-sunk">
          {x.image ? (
            <Image src={x.image} alt="" fill sizes="48px" className="object-cover" />
          ) : (
            <span className="grid h-full place-items-center font-display text-lg text-muted" aria-hidden>
              {x.dish.slice(0, 1)}
            </span>
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-semibold">{x.dish}</span>
          <span className="truncate text-xs text-muted">
            {[x.label, x.minutes ? `${x.minutes} min` : null, x.plate ? `${money(x.plate)} a plate` : null].filter(Boolean).join(" · ")}
            {x.offDiet && <span className="text-chili"> · Not your diet</span>}
          </span>
        </span>
        <span className="shrink-0 text-sm font-semibold text-basil">{busy === x.id ? "Adding…" : x.id === current ? "Current" : "Pick"}</span>
      </button>
    </li>
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search recipes"
          aria-label="Search recipes"
          className="input flex-1"
        />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyMeal} onChange={(e) => setOnlyMeal(e.target.checked)} className="size-4 accent-[var(--basil)]" />
          Only {meal} recipes
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        {leftover && (
          <button type="button" disabled={pending} onClick={() => choose("leftover")} className="btn btn-ghost btn-sm">
            {busy === "leftover" ? "Adding…" : `Leftovers from ${leftover.day}'s ${leftover.dish}`}
          </button>
        )}
        <button type="button" disabled={pending} onClick={() => choose(null)} className="btn btn-ghost btn-sm">
          {busy === "clear" ? "Clearing…" : "Leave it open (eating out)"}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-chili">
          {error}
        </p>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-xl font-bold">My recipes</h2>
        {mine.length ? (
          <ul className="grid gap-2 sm:grid-cols-2">{mine.slice(0, SHOW).map(row)}</ul>
        ) : (
          <p className="text-sm text-muted">
            {items.some((x) => x.mine) ? "None match. Try clearing the search or the meal filter." : "Nothing saved yet. Add your own recipe, or pick one below."}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-xl font-bold">All recipes</h2>
        {rest.length ? (
          <>
            <ul className="grid gap-2 sm:grid-cols-2">{rest.slice(0, SHOW).map(row)}</ul>
            {rest.length > SHOW && <p className="text-sm text-muted">Showing {SHOW} of {rest.length}. Search to find the rest.</p>}
          </>
        ) : (
          <p className="text-sm text-muted">None match. Try clearing the search or the meal filter.</p>
        )}
      </section>
    </div>
  );
}
