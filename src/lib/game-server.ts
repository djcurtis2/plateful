import "server-only";
import { admin } from "@/lib/supabase/admin";
import { chefCards } from "@/lib/avatar-server";
import type { BadgeId, Database, PointsKind } from "@/lib/database.types";
import {
  BADGES,
  POINTS,
  PRIZES,
  VOTES_PER_COOKOFF,
  computeStreak,
  levelFor,
  rankEntries,
  streakBonus,
} from "@/lib/game";

// ---------------------------------------------------------------------------
// Ledger primitives. Every award is idempotent: (user, kind, ref) is unique.

export async function awardPoints(userId: string, kind: PointsKind, points: number, ref: string, challengeId: string | null = null) {
  if (points <= 0) return;
  const { error } = await admin()
    .from("points_events")
    .upsert({ user_id: userId, kind, points, ref, challenge_id: challengeId }, { onConflict: "user_id,kind,ref", ignoreDuplicates: true });
  if (error) console.error("awardPoints failed", kind, error.message);
}

export async function revokePoints(userId: string, kind: PointsKind, ref: string) {
  await admin().from("points_events").delete().eq("user_id", userId).eq("kind", kind).eq("ref", ref);
}

export async function awardBadge(userId: string, badge: BadgeId, challengeId: string | null = null) {
  const { error } = await admin().from("user_badges").insert({ user_id: userId, badge, challenge_id: challengeId });
  if (error && error.code !== "23505") console.error("awardBadge failed", badge, error.message); // 23505 = already has it
}

function extendIso(from: string | null, days: number) {
  const base = from && new Date(from) > new Date() ? new Date(from) : new Date();
  return new Date(base.getTime() + days * 86_400_000).toISOString();
}

export async function grantPlusMonths(userId: string, months: number) {
  const db = admin();
  const { data } = await db.from("profiles").select("bonus_until").eq("id", userId).maybeSingle();
  await db.from("profiles").update({ bonus_until: extendIso(data?.bonus_until ?? null, months * 30) }).eq("id", userId);
}

// ---------------------------------------------------------------------------
// Challenges

export async function allChallengesNewestFirst() {
  const { data } = await admin()
    .from("challenges")
    .select("id, slug, title, starts_at, ends_at, finalized_at, recipe_id, chef_pick_attempt_id, crowd_winner_attempt_id")
    .lte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: false });
  return data ?? [];
}

export async function streakFor(userId: string) {
  const [challenges, { data: mine }] = await Promise.all([
    allChallengesNewestFirst(),
    admin().from("attempts").select("challenge_id").eq("user_id", userId).eq("hidden", false).not("challenge_id", "is", null),
  ]);
  return computeStreak(challenges, new Set((mine ?? []).map((a) => a.challenge_id as string)));
}

// ---------------------------------------------------------------------------
// Event hooks

/** A cook-off entry was posted (or replaced). Points and badges are awarded once per entry. */
export async function onEntryPosted(userId: string, attemptId: string, challengeId: string | null) {
  if (!challengeId) return;
  await awardPoints(userId, "post", POINTS.post, attemptId, challengeId);
  await awardBadge(userId, "first_copycat");
  const streak = await streakFor(userId);
  await awardPoints(userId, "streak", streakBonus(streak), challengeId, challengeId);
  if (streak >= 4) await awardBadge(userId, "streak_4");
}

/** A vote was cast or taken back. Voter earns for voting; the entry's owner earns for receiving. */
export async function onVote(r: { voted: boolean; owner_id: string; challenge_id: string }, voterId: string, attemptId: string) {
  const receivedRef = `${voterId}:${attemptId}`;
  if (r.voted) {
    await awardPoints(voterId, "vote_cast", POINTS.vote_cast, attemptId, r.challenge_id);
    await awardPoints(r.owner_id, "vote_received", POINTS.vote_received, receivedRef, r.challenge_id);
  } else {
    await revokePoints(voterId, "vote_cast", attemptId);
    await revokePoints(r.owner_id, "vote_received", receivedRef);
  }
}

export async function onReferralSignup(referrerId: string, friendId: string) {
  await awardPoints(referrerId, "referral_signup", POINTS.referral_signup, friendId);
}

export async function onReferralCook(referrerId: string, friendId: string, totalCooks: number) {
  await awardPoints(referrerId, "referral_cook", POINTS.referral_cook, friendId);
  if (totalCooks >= 3) await awardBadge(referrerId, "brought_3");
}

// ---------------------------------------------------------------------------
// Player stats

export async function playerStats(userId: string, liveChallengeId: string | null) {
  const db = admin();
  const [{ data: events }, { data: badges }, streak, votesUsed] = await Promise.all([
    db.from("points_events").select("points, challenge_id").eq("user_id", userId),
    db.from("user_badges").select("badge, challenge_id, created_at").eq("user_id", userId).order("created_at", { ascending: false }),
    streakFor(userId),
    liveChallengeId
      ? db
          .from("attempt_votes")
          .select("attempt_id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("challenge_id", liveChallengeId)
          .then((r) => r.count ?? 0)
      : Promise.resolve(0),
  ]);
  const total = (events ?? []).reduce((s, e) => s + e.points, 0);
  const week = liveChallengeId ? (events ?? []).filter((e) => e.challenge_id === liveChallengeId).reduce((s, e) => s + e.points, 0) : 0;
  return {
    points: total,
    weekPoints: week,
    level: levelFor(total),
    streak,
    votesLeft: Math.max(0, VOTES_PER_COOKOFF - votesUsed),
    badges: (badges ?? []).map((b) => ({ ...b, ...BADGES[b.badge] })),
  };
}

/** Light stats for the header on every page: points, level and badges (newest first). */
export async function headerStats(userId: string) {
  const db = admin();
  const [{ data: events }, { data: badges }] = await Promise.all([
    db.from("points_events").select("points").eq("user_id", userId).limit(20000),
    db.from("user_badges").select("badge, created_at").eq("user_id", userId).order("created_at", { ascending: false }),
  ]);
  const points = (events ?? []).reduce((s, e) => s + e.points, 0);
  return { points, level: levelFor(points), badges: (badges ?? []).map((b) => b.badge) };
}

export async function publicNames(userIds: string[]): Promise<Record<string, string | null>> {
  if (!userIds.length) return {};
  const { data } = await admin().from("profiles").select("id, public_name").in("id", [...new Set(userIds)]);
  return Object.fromEntries((data ?? []).map((p) => [p.id, p.public_name]));
}

/** Points leaderboard: this cook-off's points, or all-time. Aggregated in app code (fine at early scale). */
export async function leaderboard(scope: { challengeId: string } | "all", limit = 25) {
  let q = admin().from("points_events").select("user_id, points").limit(20000);
  if (scope !== "all") q = q.eq("challenge_id", scope.challengeId);
  const { data } = await q;
  const totals = new Map<string, number>();
  for (const e of data ?? []) totals.set(e.user_id, (totals.get(e.user_id) ?? 0) + e.points);
  const rows = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
  const ids = rows.map(([id]) => id);
  const chefs = await chefCards(ids);
  // Levels always come from all-time points, even on the weekly board.
  let lifetime = totals;
  if (scope !== "all" && ids.length) {
    const { data: all } = await admin().from("points_events").select("user_id, points").in("user_id", ids).limit(20000);
    lifetime = new Map();
    for (const e of all ?? []) lifetime.set(e.user_id, (lifetime.get(e.user_id) ?? 0) + e.points);
  }
  // Each cook's badges (distinct, best first) for the little icon row.
  const { data: badgeRows } = ids.length ? await admin().from("user_badges").select("user_id, badge").in("user_id", ids) : { data: [] };
  const order = Object.keys(BADGES) as BadgeId[];
  const badgesBy = new Map<string, Set<BadgeId>>();
  for (const b of badgeRows ?? []) {
    if (!badgesBy.has(b.user_id)) badgesBy.set(b.user_id, new Set());
    badgesBy.get(b.user_id)!.add(b.badge);
  }
  return rows.map(([userId, points], i) => {
    const level = levelFor(lifetime.get(userId) ?? points);
    return {
      rank: i + 1,
      userId,
      points,
      name: chefs[userId]?.name ?? null,
      chef: chefs[userId],
      level: level.name,
      levelIndex: level.index,
      badges: order.filter((b) => badgesBy.get(userId)?.has(b)),
    };
  });
}

// ---------------------------------------------------------------------------
// Finalizing a cook-off (admin)

export type FinalizeResult =
  | { ok: true; crowdWinner: string | null; chefPick: string | null; thriftiest: string | null; top10: number }
  | { ok: false; message: string };

/**
 * Locks in a finished cook-off: crowd favorite = most votes (earliest entry wins ties),
 * chef's pick = the admin's choice. Awards badges, points, Plus months and records the social feature.
 */
export async function finalizeChallenge(challengeId: string): Promise<FinalizeResult> {
  const db = admin();
  const { data: c } = await db
    .from("challenges")
    .select("id, ends_at, finalized_at, chef_pick_attempt_id")
    .eq("id", challengeId)
    .maybeSingle();
  if (!c) return { ok: false, message: "Cook-off not found." };
  if (c.finalized_at) return { ok: false, message: "This cook-off is already finalized." };
  if (new Date(c.ends_at) > new Date()) return { ok: false, message: "Voting is still open. Finalize after it ends." };

  const { data: entries } = await db
    .from("attempts")
    .select("id, user_id, votes, created_at, cost_per_plate, cost_source")
    .eq("challenge_id", challengeId)
    .eq("hidden", false);
  const ranked = rankEntries(entries ?? []);
  const crowd = ranked[0] && ranked[0].votes > 0 ? ranked[0] : null;
  const chef = (entries ?? []).find((e) => e.id === c.chef_pick_attempt_id) ?? null;
  // Thriftiest copy: lowest receipt-verified price per plate (earliest entry wins ties).
  const thrifty =
    (entries ?? [])
      .filter((e) => e.cost_source === "receipt" && e.cost_per_plate != null)
      .sort((a, b) => Number(a.cost_per_plate) - Number(b.cost_per_plate) || a.created_at.localeCompare(b.created_at))[0] ?? null;

  // Lock first, so a double click can't award twice (awards are also idempotent).
  const { data: locked } = await db
    .from("challenges")
    .update({ finalized_at: new Date().toISOString(), crowd_winner_attempt_id: crowd?.id ?? null, thriftiest_attempt_id: thrifty?.id ?? null })
    .eq("id", challengeId)
    .is("finalized_at", null)
    .select("id");
  if (!locked?.length) return { ok: false, message: "This cook-off is already finalized." };

  type Win = { entry: { user_id: string }; reason: "crowd_favorite" | "chef_pick" | "thriftiest" };
  const winners: Win[] = [];
  if (crowd) winners.push({ entry: crowd, reason: "crowd_favorite" });
  if (chef) winners.push({ entry: chef, reason: "chef_pick" });
  if (thrifty) winners.push({ entry: thrifty, reason: "thriftiest" });
  const winPoints = { crowd_favorite: ["win", POINTS.win], chef_pick: ["chef_pick", POINTS.chef_pick], thriftiest: ["thriftiest", POINTS.thriftiest] } as const;

  for (const { entry, reason } of winners) {
    const prize = PRIZES[reason];
    const [kind, pts] = winPoints[reason];
    await awardBadge(entry.user_id, reason, challengeId);
    await awardPoints(entry.user_id, kind, pts, `${challengeId}:${reason}`, challengeId);
    const months = `${prize.plusMonths} ${prize.plusMonths === 1 ? "month" : "months"} of Plus`;
    const rows: Database["public"]["Tables"]["prize_awards"]["Insert"][] = [
      { user_id: entry.user_id, kind: "plus_months", reason, challenge_id: challengeId, detail: months, status: "fulfilled", fulfilled_at: new Date().toISOString() },
    ];
    if (reason !== "thriftiest") {
      rows.push({ user_id: entry.user_id, kind: "social_feature", reason, challenge_id: challengeId, detail: "Feature on homepage and Yumjack socials", status: "pending" });
    }
    const { error } = await db.from("prize_awards").insert(rows);
    if (!error) await grantPlusMonths(entry.user_id, prize.plusMonths);
  }

  const top10 = ranked.filter((e) => e.votes > 0).slice(0, 10);
  for (const e of top10) {
    await awardBadge(e.user_id, "top10", challengeId);
    await awardPoints(e.user_id, "top10", POINTS.top10, challengeId, challengeId);
  }

  return { ok: true, crowdWinner: crowd?.id ?? null, chefPick: chef?.id ?? null, thriftiest: thrifty?.id ?? null, top10: top10.length };
}

/** Most points earned in a calendar month (UTC), for the monthly gift card. Trivia points don't count: the prize is for cooking. */
export async function monthlyTop(period: string) {
  const [y, m] = period.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1)).toISOString();
  const end = new Date(Date.UTC(y, m, 1)).toISOString();
  const { data } = await admin().from("points_events").select("user_id, points").not("kind", "in", "(trivia,game)").gte("created_at", start).lt("created_at", end).limit(20000);
  const totals = new Map<string, number>();
  for (const e of data ?? []) totals.set(e.user_id, (totals.get(e.user_id) ?? 0) + e.points);
  const top = [...totals.entries()].sort((a, b) => b[1] - a[1])[0];
  if (!top) return null;
  const names = await publicNames([top[0]]);
  return { userId: top[0], points: top[1], name: names[top[0]] ?? null };
}
