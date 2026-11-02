"use client";
import { useState, useTransition } from "react";
import { setDiets } from "@/app/actions";
import { ALLERGY_NOTE, DIETS, DIET_IDS } from "@/lib/diet";

/** Your diets: used to filter My recipes, suggestions and weekly plans, and to flag recipes that don't fit. */
export function DietForm({ initial }: { initial: string[] }) {
  const [diets, setLocal] = useState<Set<string>>(new Set(initial));
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-2">
      <span className="label">My diet</span>
      <div className="flex flex-wrap gap-2">
        {DIET_IDS.map((d) => (
          <label key={d} className="cursor-pointer">
            <input
              type="checkbox"
              className="peer sr-only"
              checked={diets.has(d)}
              disabled={pending}
              onChange={(e) => {
                const n = new Set(diets);
                if (e.target.checked) n.add(d);
                else n.delete(d);
                setLocal(n);
                start(async () => {
                  const r = await setDiets([...n]);
                  setMsg(r.ok ? "Saved" : r.message);
                });
              }}
            />
            <span className="inline-block rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-semibold peer-checked:border-basil peer-checked:bg-basil peer-checked:text-basil-ink peer-focus-visible:ring-2 peer-focus-visible:ring-basil">
              {DIETS[d]}
            </span>
          </label>
        ))}
      </div>
      <p className="text-xs text-muted">
        Used to filter suggestions, weekly plans and My recipes, and to flag recipes that don&apos;t fit. {ALLERGY_NOTE}
        {msg && <span className="ml-2 font-semibold text-basil">{msg}</span>}
      </p>
    </div>
  );
}
