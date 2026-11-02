"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { admin } from "@/lib/supabase/admin";
import { getCurrentChallenge, getLatestPlan, getMe, getPantry, getRecipeBySlug, getRecipesByIds, getSuggestionPool, isLive } from "@/lib/data";
import { pantryKey } from "@/lib/format";
import { planWeek, summarize, swapMeal, type PlanSettings } from "@/lib/planner";
import { createOriginal } from "@/lib/originals";
import { shareLabel } from "@/lib/leftovers";
import { logCook } from "@/lib/savings-server";

type R = { ok: true; message?: string } | { ok: false; message: string };
const PLUS_ONLY: R = { ok: false, message: "Plan my week is part of Plateful Plus." };

const Settings = z.object({
  dinners: z.coerce.number().int().min(3).max(7),
  servings: z.coerce.number().int().min(1).max(8),
  maxMinutes: z.union([z.literal(""), z.coerce.number().int().min(15).max(240)]),
  cuisines: z.array(z.string().max(60)).max(20),
  includeCookoff: z.boolean(),
  include: z.string().max(120),
});

async function plusUser() {
  const me = await getMe();
  return me?.plus ? me : null;
}

/** Builds a new week of dinners from the recipe pool, favoring ones that share ingredients. */
export async function createPlan(formData: FormData): Promise<R> {
  const me = await plusUser();
  if (!me) return PLUS_ONLY;
  const p = Settings.safeParse({
    dinners: formData.get("dinners"),
    servings: formData.get("servings"),
    maxMinutes: formData.get("maxMinutes") ?? "",
    cuisines: formData.getAll("cuisines").map(String),
    includeCookoff: formData.get("includeCookoff") === "on",
    include: String(formData.get("include") ?? ""),
  });
  if (!p.success) return { ok: false, message: "Pick 3 to 7 dinners and 1 to 8 people." };
  const settings: PlanSettings = {
    dinners: p.data.dinners,
    servings: p.data.servings,
    maxMinutes: p.data.maxMinutes === "" ? null : p.data.maxMinutes,
    cuisines: p.data.cuisines,
    diets: me.profile?.diets ?? [],
  };

  const [pool, pantry, challenge, included] = await Promise.all([
    getSuggestionPool(me.user.id, 400),
    getPantry(me.user.id),
    p.data.includeCookoff ? getCurrentChallenge() : Promise.resolve(null),
    p.data.include ? getRecipeBySlug(p.data.include) : Promise.resolve(null),
  ]);
  const include = [included, challenge && isLive(challenge) ? challenge.recipe : null].filter((r) => r !== null);
  const week = planWeek(pool, settings, pantry.map(pantryKey), { include });
  if (!week.length) return { ok: false, message: "No dinners match those choices. Try fewer limits." };

  const { error } = await admin().from("meal_plans").insert({ user_id: me.user.id, settings, recipe_ids: week.map((r) => r.id) });
  if (error) return { ok: false, message: "Couldn't save your plan. Try again." };
  revalidatePath("/plan");
  return { ok: true };
}

/** Replaces one dinner with the next-best fit for the rest of the week. */
export async function swapPlanMeal(planId: string, index: number): Promise<R> {
  const me = await plusUser();
  if (!me) return PLUS_ONLY;
  const plan = await getLatestPlan(me.user.id);
  if (!plan || plan.id !== planId || index < 0 || index >= plan.recipe_ids.length) return { ok: false, message: "That plan has changed. Refresh the page." };
  const [current, pool, pantry] = await Promise.all([getRecipesByIds(plan.recipe_ids), getSuggestionPool(me.user.id, 400), getPantry(me.user.id)]);
  const avoid = new Set(plan.swapped);
  const next = swapMeal(current, index, pool, plan.settings, pantry.map(pantryKey), avoid);
  if (!next) return { ok: false, message: "No other dinners fit. Try “Add new recipes” below, or loosen your limits." };
  const ids = [...plan.recipe_ids];
  const out = ids[index];
  ids[index] = next.id;
  await admin()
    .from("meal_plans")
    .update({ recipe_ids: ids, swapped: [...plan.swapped, out], updated_at: new Date().toISOString() })
    .eq("id", plan.id);
  revalidatePath("/plan");
  return { ok: true };
}

/** Takes one dinner out of the plan. */
export async function removePlanMeal(planId: string, index: number): Promise<R> {
  const me = await plusUser();
  if (!me) return PLUS_ONLY;
  const plan = await getLatestPlan(me.user.id);
  if (!plan || plan.id !== planId || plan.recipe_ids.length <= 1) return { ok: false, message: "That plan has changed. Refresh the page." };
  const ids = plan.recipe_ids.filter((_, i) => i !== index);
  await admin().from("meal_plans").update({ recipe_ids: ids, updated_at: new Date().toISOString() }).eq("id", plan.id);
  revalidatePath("/plan");
  return { ok: true };
}

/**
 * Not enough recipes fit? Claude writes new Plateful originals built on this week's leftovers,
 * one per click (each takes ~15 seconds), until the plan is full.
 */
export async function fillPlanGap(planId: string): Promise<R> {
  const me = await plusUser();
  if (!me) return PLUS_ONLY;
  const plan = await getLatestPlan(me.user.id);
  if (!plan || plan.id !== planId) return { ok: false, message: "That plan has changed. Refresh the page." };
  if (plan.recipe_ids.length >= plan.settings.dinners) return { ok: true, message: "Your week is already full." };
  const [current, pantry] = await Promise.all([getRecipesByIds(plan.recipe_ids), getPantry(me.user.id)]);
  const sum = summarize(current, plan.settings.servings, pantry.map(pantryKey));
  const left = sum.leftovers.length
    ? sum.leftovers.slice(0, 6).map((l) => ({ name: l.name, share: shareLabel({ share: l.share, measured: true }) }))
    : [{ name: "whatever is in season", share: "some" }];
  const r = await createOriginal({
    userId: me.user.id,
    plus: true,
    leftovers: left,
    style: plan.settings.maxMinutes && plan.settings.maxMinutes <= 30 ? "weeknight" : "surprise",
    avoidDish: current.map((c) => c.dish).join(", ").slice(0, 90) || "nothing yet",
    inspiredBy: null,
    dinnerOnly: true,
  });
  if (!r.ok) return { ok: false, message: r.message };
  await admin()
    .from("meal_plans")
    .update({ recipe_ids: [...plan.recipe_ids, r.id], updated_at: new Date().toISOString() })
    .eq("id", plan.id);
  revalidatePath("/plan");
  return { ok: true, message: "Added a new recipe." };
}

/** Tick off a dinner as cooked: logs the savings for the plan's number of people. */
export async function markPlanMealCooked(planId: string, index: number): Promise<R> {
  const me = await plusUser();
  if (!me) return PLUS_ONLY;
  const plan = await getLatestPlan(me.user.id);
  if (!plan || plan.id !== planId || index < 0 || index >= plan.recipe_ids.length) return { ok: false, message: "That plan has changed. Refresh the page." };
  const [recipe] = await getRecipesByIds([plan.recipe_ids[index]]);
  if (!recipe) return { ok: false, message: "That recipe is gone." };
  await admin().from("saved_recipes").upsert({ user_id: me.user.id, recipe_id: recipe.id, cooked_at: new Date().toISOString() });
  const s = await logCook({ userId: me.user.id, recipe, servings: plan.settings.servings, source: "plan" });
  revalidatePath("/plan");
  return { ok: true, message: s ? `Saved $${s.saved.toFixed(2)}` : "Marked as made" };
}
