"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { admin } from "@/lib/supabase/admin";
import { getCurrentChallenge, getLatestPlan, getMe, getPantry, getRecipeBySlug, getRecipesByIds, getSuggestionPool, getUsableRecipe, isLive, type MealPlanRow } from "@/lib/data";
import { pantryKey } from "@/lib/format";
import { PLAN_MEALS, planWeek, slotIds, summarizeWeek, swapSlot, type PlanSettings, type PlanSlot } from "@/lib/planner";
import { createOriginal } from "@/lib/originals";
import { shareLabel } from "@/lib/leftovers";
import { logCook } from "@/lib/savings-server";

type R = { ok: true; message?: string } | { ok: false; message: string };
const PLUS_ONLY: R = { ok: false, message: "Plan my week is part of Dupe Kitchen Plus." };
const CHANGED: R = { ok: false, message: "That plan has changed. Refresh the page." };

const Settings = z.object({
  days: z.coerce.number().int().min(3).max(7),
  meals: z.array(z.enum(PLAN_MEALS)).min(1).max(4),
  servings: z.coerce.number().int().min(1).max(8),
  maxMinutes: z.union([z.literal(""), z.coerce.number().int().min(15).max(240)]),
  cuisines: z.array(z.string().max(60)).max(20),
  includeCookoff: z.boolean(),
  include: z.string().max(120),
  fill: z.enum(["auto", "empty"]),
});

async function plusUser() {
  const me = await getMe();
  return me?.plus ? me : null;
}

/** This person's latest plan, if it's the one the page was showing. */
async function currentPlan(userId: string, planId: string, index?: number) {
  const plan = await getLatestPlan(userId);
  if (!plan || plan.id !== planId) return null;
  if (index !== undefined && (!Number.isInteger(index) || index < 0 || index >= plan.slots.length)) return null;
  return plan;
}

/** Saves the week's spots (recipe_ids is kept in step for older readers). */
async function saveSlots(plan: Pick<MealPlanRow, "id">, slots: PlanSlot[], extra: { swapped?: string[] } = {}) {
  await admin()
    .from("meal_plans")
    .update({ slots, recipe_ids: slotIds(slots), ...extra, updated_at: new Date().toISOString() })
    .eq("id", plan.id);
  revalidatePath("/plan");
}

/** Builds a new week from the recipe pool, favoring meals that share ingredients. Or an empty week to fill by hand. */
export async function createPlan(formData: FormData): Promise<R> {
  const me = await plusUser();
  if (!me) return PLUS_ONLY;
  const p = Settings.safeParse({
    days: formData.get("days"),
    meals: formData.getAll("meals").map(String),
    servings: formData.get("servings"),
    maxMinutes: formData.get("maxMinutes") ?? "",
    cuisines: formData.getAll("cuisines").map(String),
    includeCookoff: formData.get("includeCookoff") === "on",
    include: String(formData.get("include") ?? ""),
    fill: formData.get("fill") ?? "auto",
  });
  if (!p.success) return { ok: false, message: "Pick 3 to 7 days, at least one meal, and 1 to 8 people." };
  const settings: PlanSettings = {
    days: p.data.days,
    meals: PLAN_MEALS.filter((m) => p.data.meals.includes(m)),
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
  const slots = planWeek(pool, settings, pantry.map(pantryKey), { include, empty: p.data.fill === "empty" });
  if (p.data.fill === "auto" && !slots.some((x) => x.id)) return { ok: false, message: "No recipes match those choices. Try fewer limits." };

  const { error } = await admin().from("meal_plans").insert({ user_id: me.user.id, settings, slots, recipe_ids: slotIds(slots) });
  if (error) return { ok: false, message: "Couldn't save your plan. Try again." };
  revalidatePath("/plan");
  return { ok: true };
}

/** Replaces one spot with the best new recipe for the rest of the week. */
export async function swapPlanMeal(planId: string, index: number): Promise<R> {
  const me = await plusUser();
  if (!me) return PLUS_ONLY;
  const plan = await currentPlan(me.user.id, planId, index);
  if (!plan) return CHANGED;
  const [current, pool, pantry] = await Promise.all([getRecipesByIds(slotIds(plan.slots)), getSuggestionPool(me.user.id, 400), getPantry(me.user.id)]);
  const byId = new Map(current.map((r) => [r.id, r]));
  const next = swapSlot(plan.slots, index, byId, pool, plan.settings, pantry.map(pantryKey), new Set(plan.swapped));
  if (!next) return { ok: false, message: "Nothing else fits. Pick one yourself, or loosen your limits." };
  const out = plan.slots[index].id;
  const slots = plan.slots.map((x, i) => (i === index ? { day: x.day, meal: x.meal, id: next.id } : x));
  await saveSlots(plan, slots, { swapped: out ? [...plan.swapped, out] : plan.swapped });
  return { ok: true };
}

/**
 * Puts a recipe you chose in one spot: any public recipe or one of your own. "leftover" eats the dinner from
 * the day before (it's cooked double); null clears the spot (eating out, or not decided).
 */
export async function setPlanSlot(planId: string, index: number, choice: string | null): Promise<R> {
  const me = await plusUser();
  if (!me) return PLUS_ONLY;
  const plan = await currentPlan(me.user.id, planId, index);
  if (!plan) return CHANGED;
  const at = plan.slots[index];
  let next: PlanSlot = { day: at.day, meal: at.meal, id: null };
  if (choice === "leftover") {
    const dinner = plan.slots.find((x) => x.day === at.day - 1 && x.meal === "dinner" && x.id && !x.leftover);
    if (!dinner) return { ok: false, message: "There's no dinner the night before to save leftovers from." };
    next = { ...next, id: dinner.id, leftover: true };
  } else if (choice) {
    if (!z.uuid().safeParse(choice).success || !(await getUsableRecipe(me.user.id, choice))) return { ok: false, message: "That recipe isn't available." };
    next = { ...next, id: choice };
  }
  await saveSlots(
    plan,
    plan.slots.map((x, i) => (i === index ? next : x)),
  );
  return { ok: true };
}

/** Clears one spot. */
export async function clearPlanSlot(planId: string, index: number): Promise<R> {
  return setPlanSlot(planId, index, null);
}

/**
 * Nothing fits a spot? Claude writes a new Dupe Kitchen original for that meal, built on this week's leftovers
 * (about 15 seconds each; counts toward the daily new-recipe limit).
 */
export async function fillPlanGap(planId: string, index: number): Promise<R> {
  const me = await plusUser();
  if (!me) return PLUS_ONLY;
  const plan = await currentPlan(me.user.id, planId, index);
  if (!plan) return CHANGED;
  const at = plan.slots[index];
  if (at.id) return { ok: true, message: "That spot is already filled." };
  const [current, pantry] = await Promise.all([getRecipesByIds(slotIds(plan.slots)), getPantry(me.user.id)]);
  const sum = summarizeWeek(plan.slots, new Map(current.map((r) => [r.id, r])), plan.settings.servings, pantry.map(pantryKey));
  const left = sum.leftovers.length
    ? sum.leftovers.slice(0, 6).map((l) => ({ name: l.name, share: shareLabel({ share: l.share, measured: true }) }))
    : [{ name: "whatever is in season", share: "some" }];
  const r = await createOriginal({
    userId: me.user.id,
    plus: true,
    leftovers: left,
    style: at.meal === "dinner" && plan.settings.maxMinutes && plan.settings.maxMinutes <= 30 ? "weeknight" : "surprise",
    avoidDish: current.map((c) => c.dish).join(", ").slice(0, 90) || "nothing yet",
    inspiredBy: null,
    meal: at.meal,
  });
  if (!r.ok) return { ok: false, message: r.message };
  // Re-read: the spot may have been filled while Claude was writing.
  const fresh = await currentPlan(me.user.id, planId, index);
  if (!fresh || fresh.slots[index].id) return { ok: true, message: "Saved the new recipe to My recipes." };
  await saveSlots(
    fresh,
    fresh.slots.map((x, i) => (i === index ? { day: x.day, meal: x.meal, id: r.id } : x)),
  );
  return { ok: true, message: "Added a new recipe." };
}

/** Tick off a meal as cooked: logs the savings for everyone it feeds, including tomorrow's leftover lunch. */
export async function markPlanMealCooked(planId: string, index: number): Promise<R> {
  const me = await plusUser();
  if (!me) return PLUS_ONLY;
  const plan = await currentPlan(me.user.id, planId, index);
  const at = plan?.slots[index];
  if (!plan || !at?.id || at.leftover) return CHANGED;
  const [recipe] = await getRecipesByIds([at.id]);
  if (!recipe) return { ok: false, message: "That recipe is gone." };
  const leftovers = plan.slots.filter((x, i) => i > index && x.leftover && x.id === at.id && x.day === at.day + 1).length;
  await admin().from("saved_recipes").upsert({ user_id: me.user.id, recipe_id: recipe.id, cooked_at: new Date().toISOString() });
  const s = await logCook({ userId: me.user.id, recipe, servings: plan.settings.servings * (1 + leftovers), source: "plan" });
  await saveSlots(
    plan,
    plan.slots.map((x, i) => (i === index ? { ...x, made: true } : x)),
  );
  return { ok: true, message: s ? `Saved $${s.saved.toFixed(2)}` : "Marked as made" };
}
