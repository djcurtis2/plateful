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

/** Replaces the list with the same id, puts it first, and keeps only the newest `max`. */
export function upsertOfflineList(all: OfflineList[], list: OfflineList, max = 5): OfflineList[] {
  return [list, ...all.filter((l) => l.id !== list.id)].slice(0, max);
}

/** Whichever side ticked most recently wins. */
export function mergeTicks(siteTicks: string[], offlineTicks: string[], offlineNewer: boolean): string[] {
  return offlineNewer ? offlineTicks : siteTicks;
}
