import "server-only";
import { admin } from "@/lib/supabase/admin";
import { adaptRecipe, inventRecipe } from "@/lib/claude";
import { LEFTOVER_SCAN, recordScan, siteCapReached } from "@/lib/limits";
import { LEFTOVER_STYLES, slugify, type LeftoverStyle } from "@/lib/recipe";
import { VERSIONS, dietTagsFrom, type VersionKind } from "@/lib/diet";
import type { Recipe } from "@/lib/recipe";

/** New Dupe Kitchen originals: Plus gets 15 a day; free accounts get 1 to try the feature. */
export const ORIGINALS_LIMIT = { plusPerDay: 15, freeLifetime: 1 };

/** How many more originals this person can make right now. */
export async function originalsLeft(userId: string, plus: boolean): Promise<number> {
  let q = admin().from("scans").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("ip_hash", LEFTOVER_SCAN).not("input_tokens", "is", null);
  if (plus) q = q.gte("created_at", new Date(Date.now() - 86_400_000).toISOString());
  const { count } = await q;
  return Math.max(0, (plus ? ORIGINALS_LIMIT.plusPerDay : ORIGINALS_LIMIT.freeLifetime) - (count ?? 0));
}

/**
 * Claude writes an original recipe around some leftovers; it's saved as a public recipe and added to the person's library.
 * Shared by "Make something new" on recipe pages and by "Plan my week" when it needs more dinners.
 */
export async function createOriginal(input: {
  userId: string;
  plus: boolean;
  leftovers: { name: string; share: string }[];
  style: LeftoverStyle;
  avoidDish: string;
  inspiredBy: string | null;
  dinnerOnly?: boolean;
}): Promise<{ ok: true; slug: string; id: string } | { ok: false; message: string }> {
  if (await siteCapReached()) return { ok: false, message: "We've hit today's limit while we scale up. Try again tomorrow." };
  if ((await originalsLeft(input.userId, input.plus)) <= 0) {
    return {
      ok: false,
      message: input.plus
        ? `That's ${ORIGINALS_LIMIT.plusPerDay} new recipes today. More tomorrow.`
        : "You've used your free try. Dupe Kitchen Plus makes new recipes from your leftovers every day.",
    };
  }
  const pick = LEFTOVER_STYLES[input.style];
  let made;
  try {
    made = await inventRecipe({
      leftovers: input.leftovers,
      styleBrief: input.dinnerOnly ? `${pick.brief}. It must be a dinner main` : pick.brief,
      avoidDish: input.avoidDish,
    });
  } catch (e) {
    console.error("original recipe failed", e);
    await recordScan({ userId: input.userId, visitorId: null, ipHash: LEFTOVER_SCAN, ok: false });
    return { ok: false, message: "Couldn't come up with a recipe just now. Try again." };
  }
  const { result, inputTokens, outputTokens } = made;
  await recordScan({ userId: input.userId, visitorId: null, ipHash: LEFTOVER_SCAN, ok: true, inputTokens, outputTokens });

  const db = admin();
  const id = crypto.randomUUID();
  const slug = `${slugify(result.dish!)}-${id.slice(0, 6)}`;
  const meals = result.meals?.length ? result.meals : ["dinner" as const];
  const { error } = await db.from("recipes").insert({
    id,
    slug,
    user_id: input.userId,
    dish: result.dish!,
    restaurant: null,
    cuisine: result.cuisine || null,
    meals: input.dinnerOnly && !meals.includes("dinner") ? [...meals, "dinner"] : meals,
    servings: result.servings ?? 2,
    minutes: result.minutes ?? null,
    difficulty: result.difficulty ?? null,
    confidence: null,
    why: result.why ?? null,
    menu_price: null,
    plate_cost: result.plate_cost ?? null,
    out_price: result.out_price ?? null,
    contains: result.contains ?? [],
    diet_tags: dietTagsFrom(result.contains ?? [], !!result.low_carb),
    ingredients: result.ingredients!,
    steps: result.steps!,
    image_path: null,
    source: "leftovers",
    style: pick.style,
    inspired_by: input.inspiredBy,
  });
  if (error) {
    console.error("original recipe insert failed", error);
    return { ok: false, message: "We made a recipe but couldn't save it. Try again." };
  }
  await db.from("saved_recipes").upsert({ user_id: input.userId, recipe_id: id });
  return { ok: true, slug, id };
}

/**
 * "Make it my way": a shared version of a recipe (one per kind per original). If someone already made
 * this version, it's reused for free; otherwise Claude writes it (counts toward the same daily limit as originals).
 * The version keeps the original's restaurant and menu price, so savings still compare with the real dish.
 */
export async function createVersion(input: { userId: string; plus: boolean; root: Recipe; kind: VersionKind }): Promise<{ ok: true; slug: string } | { ok: false; message: string }> {
  const db = admin();
  const { data: existing } = await db.from("recipes").select("id, slug").eq("variant_of", input.root.id).eq("variant_kind", input.kind).maybeSingle();
  if (existing) {
    await db.from("saved_recipes").upsert({ user_id: input.userId, recipe_id: existing.id });
    return { ok: true, slug: existing.slug };
  }
  if (await siteCapReached()) return { ok: false, message: "We've hit today's limit while we scale up. Try again tomorrow." };
  if ((await originalsLeft(input.userId, input.plus)) <= 0) {
    return {
      ok: false,
      message: input.plus
        ? `That's ${ORIGINALS_LIMIT.plusPerDay} new recipes today. More tomorrow.`
        : "You've used your free try. Dupe Kitchen Plus makes any recipe your way, every day.",
    };
  }
  const v = VERSIONS[input.kind];
  let made;
  try {
    made = await adaptRecipe({
      dish: input.root.dish,
      restaurant: input.root.restaurant,
      servings: input.root.servings,
      ingredients: input.root.ingredients,
      steps: input.root.steps,
      brief: v.brief,
      label: v.label.toLowerCase(),
    });
  } catch (e) {
    console.error("version failed", e);
    await recordScan({ userId: input.userId, visitorId: null, ipHash: LEFTOVER_SCAN, ok: false });
    return { ok: false, message: "Couldn't make that version just now. Try again." };
  }
  const { result, inputTokens, outputTokens } = made;
  await recordScan({ userId: input.userId, visitorId: null, ipHash: LEFTOVER_SCAN, ok: true, inputTokens, outputTokens });

  const contains = result.contains ?? [];
  const tags = dietTagsFrom(contains, !!result.low_carb);
  // A diet version that still breaks its diet isn't saved: better no version than a wrong one.
  if (v.diet && !tags.includes(v.diet)) {
    console.error("version missed its diet", input.kind, contains);
    return { ok: false, message: `We couldn't make a reliable ${v.label.toLowerCase()} version of this one.` };
  }
  const id = crypto.randomUUID();
  const slug = `${slugify(result.dish!, input.root.restaurant)}-${id.slice(0, 6)}`;
  const { error } = await db.from("recipes").insert({
    id,
    slug,
    user_id: input.userId,
    dish: result.dish!,
    restaurant: input.root.restaurant,
    cuisine: input.root.cuisine,
    meals: input.root.meals,
    servings: result.servings ?? input.root.servings,
    minutes: result.minutes ?? null,
    difficulty: result.difficulty ?? null,
    confidence: null,
    why: result.why ?? null,
    menu_price: input.root.menu_price,
    menu_serves: input.root.menu_serves,
    out_price: input.root.out_price ?? result.out_price ?? null,
    plate_cost: result.plate_cost ?? null,
    ingredients: result.ingredients!,
    steps: result.steps!,
    image_path: null,
    source: input.root.source,
    style: input.root.style,
    contains,
    diet_tags: tags,
    variant_of: input.root.id,
    variant_kind: input.kind,
  });
  if (error) {
    // Someone else made the same version at the same moment: use theirs.
    const { data: race } = await db.from("recipes").select("slug").eq("variant_of", input.root.id).eq("variant_kind", input.kind).maybeSingle();
    if (race) return { ok: true, slug: race.slug };
    console.error("version insert failed", error);
    return { ok: false, message: "We made it but couldn't save it. Try again." };
  }
  await db.from("saved_recipes").upsert({ user_id: input.userId, recipe_id: id });
  return { ok: true, slug };
}
