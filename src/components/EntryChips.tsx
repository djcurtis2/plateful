import { money } from "@/lib/format";
import type { Attempt } from "@/lib/data";

/** Facts voters use to judge a copy: price per plate (and whether a receipt backs it), time, swaps. */
export function EntryChips({ e, size = "sm", showSwaps = false }: { e: Pick<Attempt, "cost_per_plate" | "cost_source" | "receipt_store" | "minutes" | "swaps">; size?: "sm" | "md"; showSwaps?: boolean }) {
  const cls = size === "md" ? "px-2.5 py-1 text-sm" : "px-1.5 py-0.5 text-[11px]";
  const verified = e.cost_source === "receipt";
  return (
    <span className="flex flex-wrap gap-1">
      {e.cost_per_plate != null && (
        <span
          className={`tabular rounded-md font-mono font-semibold ${cls} ${verified ? "bg-basil text-basil-ink" : "bg-sunk text-ink"}`}
          title={verified ? `Price worked out from a ${e.receipt_store ? `${e.receipt_store} ` : ""}receipt` : "Price typed in by the cook"}
        >
          {money(e.cost_per_plate)}/plate{verified ? " ✓ Receipt" : ""}
        </span>
      )}
      {e.cost_per_plate != null && !verified && size === "md" && <span className={`rounded-md bg-sunk text-muted ${cls}`}>self-reported</span>}
      {e.minutes != null && <span className={`tabular rounded-md bg-sunk font-mono ${cls}`}>{e.minutes} min</span>}
      {showSwaps && e.swaps && <span className={`rounded-md bg-sunk ${cls}`}>Swaps: {e.swaps}</span>}
    </span>
  );
}
