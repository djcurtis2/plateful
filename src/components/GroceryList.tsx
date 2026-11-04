"use client";
import { useEffect, useState } from "react";
import type { GroceryLine } from "@/lib/planner";
import { money } from "@/lib/format";
import { STORES, STORE_IDS, type StoreId } from "@/lib/stores";

/** The week's combined shopping list, by aisle. Ticks are remembered on this device. */
export function GroceryList({ planId, lines, pantry }: { planId: string; lines: GroceryLine[]; pantry: string[] }) {
  const key = `pf_plan_ticks_${planId}`;
  const [got, setGot] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const [store, setStore] = useState<StoreId>("instacart");
  useEffect(() => {
    try {
      setGot(new Set(JSON.parse(localStorage.getItem(key) ?? "[]") as string[]));
    } catch {
      /* storage unavailable */
    }
  }, [key]);
  const toggle = (k: string) =>
    setGot((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      try {
        localStorage.setItem(key, JSON.stringify([...n]));
      } catch {
        /* storage unavailable */
      }
      return n;
    });
  const aisles = [...new Set(lines.map((l) => l.aisle))];
  const text = aisles.map((a) => `${a}\n${lines.filter((l) => l.aisle === a).map((l) => `- ${l.name} (${l.buy})`).join("\n")}`).join("\n\n");

  return (
    <div className="flex flex-col gap-4">
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
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted">
          {got.size} of {lines.length} in the cart
        </span>
        <button
          className="btn btn-ghost btn-sm"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              /* clipboard blocked */
            }
          }}
        >
          {copied ? "Copied ✓" : "Copy list"}
        </button>
      </div>
      {aisles.map((a) => (
        <div key={a}>
          <h3 className="label mb-1">{a}</h3>
          <ul className="divide-y divide-line">
            {lines
              .filter((l) => l.aisle === a)
              .map((l) => (
                <li key={l.key} className="flex items-center gap-3">
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 py-2">
                    <input type="checkbox" checked={got.has(l.key)} onChange={() => toggle(l.key)} className="size-4 accent-[var(--basil)]" />
                    <span className={`min-w-0 flex-1 ${got.has(l.key) ? "text-muted line-through" : ""}`}>
                      {l.name}
                      {l.usedBy > 1 && <span className="ml-2 rounded bg-basil/15 px-1.5 py-0.5 text-[11px] font-semibold text-basil">{l.usedBy} meals</span>}
                    </span>
                    <span className="tabular shrink-0 font-mono text-xs text-muted">
                      {l.buy} · {money(l.cost)}
                    </span>
                  </label>
                  <a
                    href={STORES[store].searchUrl(l.name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Find ${l.name} at ${STORES[store].name}`}
                    className="shrink-0 py-2 text-xs font-semibold text-basil hover:underline"
                  >
                    Find
                  </a>
                </li>
              ))}
          </ul>
        </div>
      ))}
      <p className="text-xs text-muted">Tap Find to look up an item at {STORES[store].name}. Prices are estimates and vary by store.</p>
      {pantry.length > 0 && <p className="text-xs text-muted">Already in your pantry: {pantry.join(", ")}.</p>}
    </div>
  );
}
