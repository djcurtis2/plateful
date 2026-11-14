// Grocery lists the iPhone app keeps for use with no signal (pure: shape + trimming).
export type OfflineList = {
  id: string;
  title: string;
  kind: "plan" | "recipe";
  lines: { key: string; text: string; aisle: string | null }[];
  ticks: string[];
  savedAt: string;
};

export const OFFLINE_KEY = "yj_offline_lists";

/**
 * Replaces the list with the same id, puts it first, and keeps at most `max`, newest first.
 * The newest plan list is always kept (recipe views must never push out the week's list); the other spots go to the newest lists.
 */
export function upsertOfflineList(all: OfflineList[], list: OfflineList, max = 5): OfflineList[] {
  const merged = [list, ...all.filter((l) => l.id !== list.id)];
  if (merged.length <= max) return merged;
  const plan = merged.find((l) => l.kind === "plan");
  const keep = new Set<OfflineList>(plan ? [plan] : []);
  for (const l of merged) {
    if (keep.size >= max) break;
    keep.add(l);
  }
  return merged.filter((l) => keep.has(l));
}

/** Whichever side ticked most recently wins. */
export function mergeTicks(siteTicks: string[], offlineTicks: string[], offlineNewer: boolean): string[] {
  return offlineNewer ? offlineTicks : siteTicks;
}
