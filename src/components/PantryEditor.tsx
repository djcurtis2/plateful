"use client";
import { useState, useTransition } from "react";
import { updatePantry } from "@/app/actions";
import { pantryKey } from "@/lib/format";

const STAPLES = ["salt", "black pepper", "olive oil", "vegetable oil", "butter", "garlic", "onion", "flour", "sugar", "soy sauce", "rice", "eggs"];

export function PantryEditor({ initial }: { initial: string[] }) {
  const [items, setItems] = useState(initial);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function add(names: string[]) {
    const keys = names.map(pantryKey).filter((k) => k && !items.includes(k));
    if (!keys.length) return;
    const prev = items;
    setItems([...items, ...keys].sort());
    start(async () => {
      const r = await updatePantry(keys, []);
      if (!r.ok) {
        setItems(prev);
        setError(r.message);
      }
    });
  }

  function remove(name: string) {
    const prev = items;
    setItems(items.filter((i) => i !== name));
    start(async () => {
      const r = await updatePantry([], [name]);
      if (!r.ok) {
        setItems(prev);
        setError(r.message);
      }
    });
  }

  const missingStaples = STAPLES.filter((s) => !items.includes(pantryKey(s)));

  return (
    <div className="flex flex-col gap-6">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.trim()) return setError("Type an ingredient first.");
          setError("");
          add(draft.split(",").map((s) => s.trim()).filter(Boolean));
          setDraft("");
        }}
      >
        <label htmlFor="pantry-add" className="sr-only">
          Add ingredients
        </label>
        <input id="pantry-add" className="input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add items, separated by commas" />
        <button className="btn btn-primary shrink-0" disabled={pending}>
          Add
        </button>
      </form>
      {error && (
        <p role="alert" className="-mt-4 text-sm text-chili">
          {error}
        </p>
      )}
      {missingStaples.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="label">Common staples</span>
          <div className="flex flex-wrap gap-2">
            {missingStaples.map((s) => (
              <button key={s} onClick={() => add([s])} className="rounded-full border border-line px-3 py-1 text-sm hover:border-basil">
                + {s}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="flex flex-col gap-2">
        <span className="label">On hand · {items.length}</span>
        {items.length === 0 ? (
          <p className="text-muted">Nothing yet. Tick ingredients on any recipe and they show up here.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {items.map((i) => (
              <li key={i} className="flex items-center gap-1 rounded-full bg-sunk py-1 pl-3 pr-1 text-sm">
                {i}
                <button onClick={() => remove(i)} aria-label={`Remove ${i}`} className="grid size-6 place-items-center rounded-full text-muted hover:bg-surface hover:text-ink">
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
