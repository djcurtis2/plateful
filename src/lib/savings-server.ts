import "server-only";
import { admin } from "@/lib/supabase/admin";
import { awardBadge, publicNames } from "@/lib/game-server";
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

/** Biggest savers since a date, with public names. */
export async function topSavers(since: Date, limit = 25, until: Date | null = null) {
  const { data } = await admin().rpc("top_savers", {
    p_since: since.toISOString().slice(0, 10),
    p_limit: limit,
    p_until: until ? until.toISOString().slice(0, 10) : null,
  });
  const rows = (data ?? []) as { user_id: string; saved: number | string; meals: number | string }[];
  const names = await publicNames(rows.map((r) => r.user_id));
  return rows.map((r, i) => ({ rank: i + 1, userId: r.user_id, saved: Number(r.saved), meals: Number(r.meals), name: names[r.user_id] ?? null }));
}

/** Which of these recipes this person has logged as cooked since a date (for plan check-offs). */
export async function cookedSince(userId: string, recipeIds: string[], since: string): Promise<Set<string>> {
  if (!recipeIds.length) return new Set();
  const { data } = await admin().from("cook_log").select("recipe_id").eq("user_id", userId).in("recipe_id", recipeIds).gte("cooked_on", since.slice(0, 10));
  return new Set((data ?? []).map((r) => r.recipe_id));
}
