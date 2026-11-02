import "server-only";
import { admin } from "@/lib/supabase/admin";
import { hasPlus } from "@/lib/plan";
import { cleanClubs } from "@/lib/clubs";
import { defaultAvatar, parseAvatar, unlockedGear, visibleAvatar, type Avatar, type GearContext } from "@/lib/avatar";

/** What a board or card needs to show one cook: name, display-ready avatar, clubs. */
export type ChefCard = { name: string | null; avatar: Avatar; clubs: string[] };

/** One profile query for any number of people. Everyone asked for gets a card, even with no profile row. */
export async function chefCards(userIds: string[]): Promise<Record<string, ChefCard>> {
  const ids = [...new Set(userIds)];
  if (!ids.length) return {};
  const { data } = await admin()
    .from("profiles")
    .select("id, public_name, avatar, clubs, plan, subscription_status, bonus_until")
    .in("id", ids);
  const rows = new Map((data ?? []).map((p) => [p.id, p]));
  const cards: Record<string, ChefCard> = {};
  for (const id of ids) {
    const row = rows.get(id);
    cards[id] = row
      ? {
          name: row.public_name,
          avatar: visibleAvatar(parseAvatar(row.avatar, id), hasPlus(row)),
          clubs: cleanClubs(row.clubs),
        }
      : { name: null, avatar: defaultAvatar(id), clubs: [] };
  }
  return cards;
}

/** Everything that decides which gear a person can wear: lifetime points, badges, owned items. */
export async function gearContext(userId: string, plus: boolean): Promise<GearContext> {
  const db = admin();
  const [{ data: events }, { data: badges }, { data: gear }] = await Promise.all([
    db.from("points_events").select("points").eq("user_id", userId).limit(20000),
    db.from("user_badges").select("badge").eq("user_id", userId),
    db.from("user_gear").select("item_id").eq("user_id", userId),
  ]);
  return {
    points: (events ?? []).reduce((s, e) => s + e.points, 0),
    badges: [...new Set((badges ?? []).map((b) => b.badge))],
    plus,
    owned: (gear ?? []).map((g) => g.item_id),
  };
}

/** The signed-in person's own avatar editor data. */
export async function myChef(userId: string) {
  const { data } = await admin()
    .from("profiles")
    .select("avatar, clubs, gear_seen, plan, subscription_status, bonus_until")
    .eq("id", userId)
    .maybeSingle();
  const plus = hasPlus(data);
  const ctx = await gearContext(userId, plus);
  return {
    avatar: parseAvatar(data?.avatar ?? null, userId),
    saved: data?.avatar != null,
    clubs: cleanClubs(data?.clubs),
    seen: data?.gear_seen ?? [],
    ctx,
    unlocked: unlockedGear(ctx),
  };
}
