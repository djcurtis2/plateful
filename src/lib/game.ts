// Cook-off game rules. Pure functions, shared by server and client; covered by game.test.ts.
// Tune points, levels and prizes here.

import type { BadgeId, PointsKind } from "./database.types.ts";

export const VOTES_PER_COOKOFF = 3;

export const POINTS: Record<Exclude<PointsKind, "streak">, number> = {
  post: 20,
  vote_cast: 2, // ×3 votes = 6
  vote_received: 5,
  referral_signup: 25,
  referral_cook: 50,
  win: 100,
  chef_pick: 100,
  thriftiest: 50,
  top10: 25,
  receipt: 10, // verified your price with a receipt
};

/** Entering in consecutive weeks: +10 × streak length (week 2 = 20, week 3 = 30, ...). */
export function streakBonus(streak: number): number {
  return streak >= 2 ? 10 * streak : 0;
}

export const LEVELS = [
  { name: "Line cook", min: 0 },
  { name: "Prep cook", min: 100 },
  { name: "Sous chef", min: 300 },
  { name: "Head chef", min: 700 },
  { name: "Executive chef", min: 1500 },
] as const;

export function levelFor(points: number) {
  let i = 0;
  while (i + 1 < LEVELS.length && points >= LEVELS[i + 1].min) i++;
  const current = LEVELS[i];
  const next = LEVELS[i + 1] ?? null;
  const progress = next ? (points - current.min) / (next.min - current.min) : 1;
  return { index: i, name: current.name, next: next?.name ?? null, toNext: next ? next.min - points : 0, progress };
}

export const BADGES: Record<BadgeId, { label: string; blurb: string }> = {
  first_copycat: { label: "First copycat", blurb: "Posted your first cook-off entry" },
  top10: { label: "Top 10", blurb: "Finished in the top 10 of a cook-off" },
  crowd_favorite: { label: "Crowd favorite", blurb: "Won a cook-off on votes" },
  chef_pick: { label: "Chef's pick", blurb: "Picked as the best-looking copy" },
  thriftiest: { label: "Thriftiest copy", blurb: "Cheapest receipt-verified plate of the week" },
  streak_4: { label: "4-week streak", blurb: "Entered four cook-offs in a row" },
  brought_3: { label: "Brought 3 friends", blurb: "Three friends cooked from your link" },
  saved_100: { label: "Saved $100", blurb: "Saved $100 cooking at home instead of eating out" },
  saved_500: { label: "Saved $500", blurb: "Saved $500 cooking at home instead of eating out" },
  saved_1000: { label: "Saved $1,000", blurb: "Saved $1,000 cooking at home instead of eating out" },
  saved_5000: { label: "Saved $5,000", blurb: "Saved $5,000 cooking at home instead of eating out" },
  saved_10000: { label: "Saved $10,000", blurb: "Saved $10,000 cooking at home instead of eating out" },
};

/** Weekly prizes, applied when a cook-off is finalized. */
export const PRIZES = {
  crowd_favorite: { plusMonths: 3, label: "Crowd favorite" },
  chef_pick: { plusMonths: 3, label: "Chef's pick" },
  thriftiest: { plusMonths: 1, label: "Thriftiest copy" },
  monthlyGiftCard: "$50 grocery gift card",
} as const;

/**
 * Consecutive cook-offs entered, counting back from the most recent one.
 * The live cook-off only breaks a streak once it has ended, so entering late in the week still counts.
 * `challenges` must be newest first.
 */
export function computeStreak(
  challenges: { id: string; ends_at: string }[],
  enteredIds: Set<string>,
  now = new Date(),
): number {
  let streak = 0;
  for (const [i, c] of challenges.entries()) {
    const live = new Date(c.ends_at) > now;
    if (enteredIds.has(c.id)) streak++;
    else if (i === 0 && live) continue; // haven't entered this week yet: streak still alive
    else break;
  }
  return streak;
}

/** Leaderboard order: most votes, then earliest entry (rewards being first). */
export function rankEntries<T extends { id: string; votes: number; created_at: string }>(entries: T[]): T[] {
  return [...entries].sort((a, b) => b.votes - a.votes || a.created_at.localeCompare(b.created_at));
}

/** Where an entry stands and how far it is from the next place up. */
export function standing<T extends { id: string; votes: number; created_at: string }>(entries: T[], id: string) {
  const ranked = rankEntries(entries);
  const i = ranked.findIndex((e) => e.id === id);
  if (i < 0) return null;
  const ahead = i > 0 ? ranked[i - 1] : null;
  return {
    rank: i + 1,
    of: ranked.length,
    votes: ranked[i].votes,
    // Ties break toward the earlier entry, so passing the next place needs one more vote than they have.
    behindNext: ahead ? ahead.votes - ranked[i].votes + 1 : 0,
  };
}

export function publicName(name: string | null | undefined): string {
  const n = name?.trim();
  return n ? n : "A Dupe Kitchen cook";
}

export function validPublicName(name: string): string | null {
  const n = name.trim().replace(/\s+/g, " ");
  if (n.length < 2 || n.length > 30) return "Use 2 to 30 characters.";
  if (!/^[\p{L}\p{N} .'_-]+$/u.test(n)) return "Use letters, numbers, spaces and . ' _ - only.";
  return null;
}

export function timeLeft(endsAt: string, now = new Date()): string {
  const ms = new Date(endsAt).getTime() - now.getTime();
  if (ms <= 0) return "Ended";
  const h = Math.floor(ms / 3_600_000);
  if (h >= 48) return `${Math.floor(h / 24)} days left`;
  if (h >= 1) return `${h} hours left`;
  return `${Math.max(1, Math.floor(ms / 60_000))} minutes left`;
}

export const VOTE_ERRORS: Record<string, string> = {
  own_entry: "You can't vote for your own entry.",
  no_votes_left: `You've used all ${VOTES_PER_COOKOFF} votes. Take one back to vote for someone else.`,
  closed: "Voting has closed for this cook-off.",
  not_in_cookoff: "This entry isn't part of a cook-off.",
  not_found: "That entry is no longer available.",
};

/**
 * Decides whether a receipt check counts as verified for a cook-off entry.
 * Needs a real receipt, dated from two weeks before the cook-off started until now,
 * covering at least half of the recipe's paid ingredients.
 */
export function receiptVerdict(
  r: { is_receipt: boolean; purchase_date: string | null; matched: { ingredient: string }[]; cost_per_plate: number | null; reason?: string | null },
  paidIngredientCount: number,
  windowStart: Date,
  now = new Date(),
): { ok: true; cost: number } | { ok: false; why: string } {
  if (!r.is_receipt) return { ok: false, why: r.reason ? `That doesn't look like a receipt: ${r.reason}` : "That doesn't look like a grocery receipt." };
  if (!r.purchase_date) return { ok: false, why: "We couldn't find a date on that receipt." };
  const d = new Date(`${r.purchase_date}T12:00:00Z`);
  const earliest = new Date(windowStart.getTime() - 14 * 86_400_000);
  if (Number.isNaN(d.getTime()) || d < earliest || d.getTime() > now.getTime() + 86_400_000) {
    return { ok: false, why: "That receipt is from outside this cook-off. Use one from the last couple of weeks." };
  }
  const unique = new Set(r.matched.map((m) => m.ingredient.toLowerCase())).size;
  const needed = Math.max(1, Math.ceil(paidIngredientCount / 2));
  if (unique < needed) return { ok: false, why: `That receipt only covers ${unique} of the ingredients. It needs at least ${needed}.` };
  if (r.cost_per_plate == null || !(r.cost_per_plate > 0) || r.cost_per_plate > 200) return { ok: false, why: "We couldn't work out a price per plate." };
  return { ok: true, cost: Math.round(r.cost_per_plate * 100) / 100 };
}
