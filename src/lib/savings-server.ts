import "server-only";
import { admin } from "@/lib/supabase/admin";
import { awardBadge } from "@/lib/game-server";
import { chefCards } from "@/lib/avatar-server";
import { SAVINGS_MILESTONES, savingsFor } from "@/lib/savings";
import type { Recipe } from "@/lib/recipe";

type Cookable = Pick<Recipe, "id" | "menu_price" | "menu_serves" | "plate_cost" | "out_price" | "meals" | "servings">;

/**
 * Records that someone cooked a recipe, with what eating it out would have cost.
 * Counts once per recipe per day; a later verified cook (cook-off photo) upgrades the day's entry.
 */
export async function logCook(input: { userId: string; recipe: Cookable; servings?: number; source: "made_it" | "plan" | "cookoff"; verified?: boolean }) {
  const s = savingsFor(input.recipe, input.servings ?? input.recipe.servings);
  if (!s) return null;
  const db = admin();
  const { error } = await db.from("cook_log").insert({
    user_id: input.userId,
    recipe_id: input.recipe.id,
    servings: s.servings,
    home_cost: s.home,
    out_cost: s.out,
    saved: s.saved,
    compare: s.compare,
    source: input.source,
    verified: !!input.verified,
  });
  if (error?.code === "23505") {
    if (input.verified) {
      await db.from("cook_log").update({ verified: true }).eq("user_id", input.userId).eq("recipe_id", input.recipe.id).eq("cooked_on", new Date().toISOString().slice(0, 10));
    }
    return null; // already counted today
  } else if (error) {
    console.error("cook log failed", error.message);
    return null;
  }
  await checkSavingsBadges(input.userId);
  return s;
}

export type MySavings = { saved: number; meals: number; verified: number; month: number };

export async function mySavings(userId: string): Promise<MySavings> {
  const { data } = await admin().rpc("my_savings", { p_user: userId });
  const d = (data ?? {}) as Partial<Record<keyof MySavings, number | string>>;
  return { saved: Number(d.saved ?? 0), meals: Number(d.meals ?? 0), verified: Number(d.verified ?? 0), month: Number(d.month ?? 0) };
}

async function checkSavingsBadges(userId: string) {
  const { saved } = await mySavings(userId);
  for (const m of SAVINGS_MILESTONES) if (saved >= m.amount) await awardBadge(userId, m.badge);
}

/** Everyone's savings combined, for the home page. No names. */
export async function siteSavings(): Promise<{ saved: number; meals: number; cooks: number }> {
  try {
    const { data } = await admin().rpc("savings_total", {});
    const d = (data ?? {}) as Record<string, number | string>;
    return { saved: Number(d.saved ?? 0), meals: Number(d.meals ?? 0), cooks: Number(d.cooks ?? 0) };
  } catch {
    return { saved: 0, meals: 0, cooks: 0 };
  }
}

/**
 * Biggest savers since a date, with public names. This race decides the monthly gift card, so it counts only
 * verified cooks (backed by a cook-off photo): anyone can tap "I made it", so those count toward a cook's own
 * total but not here.
 */
export async function topSavers(since: Date, limit = 25, until: Date | null = null) {
  let q = admin()
    .from("cook_log")
    .select("user_id, saved")
    .eq("verified", true)
    .gte("cooked_on", since.toISOString().slice(0, 10))
    .limit(20000);
  if (until) q = q.lt("cooked_on", until.toISOString().slice(0, 10));
  const { data } = await q;
  const totals = new Map<string, { saved: number; meals: number }>();
  for (const r of data ?? []) {
    const t = totals.get(r.user_id) ?? { saved: 0, meals: 0 };
    t.saved += Number(r.saved);
    t.meals += 1;
    totals.set(r.user_id, t);
  }
  const rows = [...totals]
    .map(([user_id, t]) => ({ user_id, ...t }))
    .sort((a, b) => b.saved - a.saved)
    .slice(0, Math.max(1, Math.min(limit, 100)));
  const chefs = await chefCards(rows.map((r) => r.user_id));
  return rows.map((r, i) => ({ rank: i + 1, userId: r.user_id, saved: Number(r.saved), meals: Number(r.meals), name: chefs[r.user_id]?.name ?? null, chef: chefs[r.user_id] }));
}

/** Which of these recipes this person has logged as cooked since a date (for plan check-offs). */
export async function cookedSince(userId: string, recipeIds: string[], since: string): Promise<Set<string>> {
  if (!recipeIds.length) return new Set();
  const { data } = await admin().from("cook_log").select("recipe_id").eq("user_id", userId).in("recipe_id", recipeIds).gte("cooked_on", since.slice(0, 10));
  return new Set((data ?? []).map((r) => r.recipe_id));
}
