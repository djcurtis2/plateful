import "server-only";
import { admin } from "@/lib/supabase/admin";
import { hasPlus } from "@/lib/plan";
import { cleanClubs } from "@/lib/clubs";
import { bingoTally } from "@/lib/games";
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
    db.from("points_events").select("points, ref").eq("user_id", userId).limit(20000),
    db.from("user_badges").select("badge").eq("user_id", userId),
    db.from("user_gear").select("item_id").eq("user_id", userId),
  ]);
  return {
    points: (events ?? []).reduce((s, e) => s + e.points, 0),
    badges: [...new Set((badges ?? []).map((b) => b.badge))],
    plus,
    owned: (gear ?? []).map((g) => g.item_id),
    bingo: bingoTally((events ?? []).map((e) => e.ref)),
  };
}

type ProfileChefFields = Parameters<typeof hasPlus>[0] & { avatar?: unknown; clubs?: unknown; gear_seen?: string[] | null };

/** What a person owns outside points and badges (shop buys, grants). */
export async function ownedGear(userId: string): Promise<string[]> {
  const { data } = await admin().from("user_gear").select("item_id").eq("user_id", userId);
  return (data ?? []).map((g) => g.item_id);
}

/** Build the chef data from a profile row and points/badges/owned the caller already has. No queries. */
export function chefFrom(
  userId: string,
  profile: ProfileChefFields | null | undefined,
  have: { points: number; badges: string[]; owned: string[]; bingo: GearContext["bingo"] },
) {
  const plus = hasPlus(profile);
  const ctx: GearContext = { points: have.points, badges: [...new Set(have.badges)] as GearContext["badges"], plus, owned: have.owned, bingo: have.bingo };
  return {
    avatar: parseAvatar(profile?.avatar ?? null, userId),
    saved: profile?.avatar != null,
    clubs: cleanClubs(profile?.clubs),
    seen: profile?.gear_seen ?? [],
    ctx,
    unlocked: unlockedGear(ctx),
  };
}

/** The signed-in person's own avatar editor data. */
export async function myChef(userId: string) {
  const { data } = await admin()
    .from("profiles")
    .select("avatar, clubs, gear_seen, plan, subscription_status, bonus_until")
    .eq("id", userId)
    .maybeSingle();
  const ctx = await gearContext(userId, hasPlus(data));
  return chefFrom(userId, data, ctx);
}
