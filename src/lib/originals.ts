import "server-only";
import { admin } from "@/lib/supabase/admin";
import { RecognitionError, adaptRecipe, buildRecipe, inventRecipe } from "@/lib/claude";
import { METHOD_BY_ID, describeBuild, type Build } from "@/lib/builder";
import { LEFTOVER_SCAN, countMarked, guardedCall, siteCapReached } from "@/lib/limits";
import { LEFTOVER_STYLES, slugify, type LeftoverStyle } from "@/lib/recipe";
import { VERSIONS, dietTagsFrom, type VersionKind } from "@/lib/diet";
import type { Recipe } from "@/lib/recipe";

const MEAL_BRIEF = { breakfast: "a breakfast", lunch: "a lunch", dinner: "a dinner main", snack: "a snack" } as const;

/** New Yumjack originals: Plus gets 15 a day; free accounts get 1 to try the feature. */
export const ORIGINALS_LIMIT = { plusPerDay: 15, freeLifetime: 1 };

/** How many more originals this person can make right now. */
export async function originalsLeft(userId: string, plus: boolean, before?: number): Promise<number> {
  const since = plus ? new Date(Date.now() - 86_400_000).toISOString() : "1970-01-01T00:00:00Z";
  const used = await countMarked(userId, LEFTOVER_SCAN, since, before);
  return Math.max(0, (plus ? ORIGINALS_LIMIT.plusPerDay : ORIGINALS_LIMIT.freeLifetime) - used);
}

/** One paid "new recipe" call (originals, builds, versions) under their shared limit, safe against taps sent at once. */
async function originalCall<T extends { inputTokens: number; outputTokens: number }>(
  who: { userId: string; plus: boolean },
  freeMessage: string,
  failMessage: string,
  call: () => Promise<T>,
): Promise<{ ok: true; made: T } | { ok: false; message: string }> {
  const r = await guardedCall({
    row: { userId: who.userId, visitorId: null, ipHash: LEFTOVER_SCAN },
    check: async (before) => {
      if (await siteCapReached(before)) return "We've hit today's limit while we scale up. Try again tomorrow.";
      if ((await originalsLeft(who.userId, who.plus, before)) <= 0) {
        return who.plus ? `That's ${ORIGINALS_LIMIT.plusPerDay} new recipes today. More tomorrow.` : freeMessage;
      }
      return null;
    },
    call,
    // A refusal or a cut-off answer was still paid for, so it uses up the try (otherwise retrying it is free).
    billedOnError: (e) => e instanceof RecognitionError,
  });
  if (r.ok) return r;
  if ("limit" in r) return { ok: false, message: r.limit };
  console.error("new recipe failed", r.error);
  return { ok: false, message: failMessage };
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
  /** Plan my week asks for a recipe for one meal. */
  meal?: "breakfast" | "lunch" | "dinner" | "snack";
}): Promise<{ ok: true; slug: string; id: string } | { ok: false; message: string }> {
  const pick = LEFTOVER_STYLES[input.style];
  const made = await originalCall(
    input,
    "You've used your free try. Yumjack Plus makes new recipes from your leftovers every day.",
    "Couldn't come up with a recipe just now. Try again.",
    () =>
      inventRecipe({
        leftovers: input.leftovers,
        styleBrief: input.meal ? `${pick.brief}. It must be ${MEAL_BRIEF[input.meal]}` : pick.brief,
        avoidDish: input.avoidDish,
      }),
  );
  if (!made.ok) return made;
  const { result } = made.made;

  return saveOriginal(input.userId, result, { style: pick.style, meal: input.meal, inspiredBy: input.inspiredBy });
}

/** Saves a Claude-written original as a public recipe and puts it in the cook's library. */
async function saveOriginal(
  userId: string,
  result: Awaited<ReturnType<typeof inventRecipe>>["result"],
  opts: { style: string; meal?: "breakfast" | "lunch" | "dinner" | "snack"; inspiredBy: string | null },
): Promise<{ ok: true; slug: string; id: string } | { ok: false; message: string }> {
  const db = admin();
  const id = crypto.randomUUID();
  const slug = `${slugify(result.dish!)}-${id.slice(0, 6)}`;
  const meals = result.meals?.length ? result.meals : [opts.meal ?? ("dinner" as const)];
  const { error } = await db.from("recipes").insert({
    id,
    slug,
    user_id: userId,
    dish: result.dish!,
    restaurant: null,
    cuisine: result.cuisine || null,
    meals: opts.meal && !meals.includes(opts.meal) ? [...meals, opts.meal] : meals,
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
    style: opts.style,
    inspired_by: opts.inspiredBy,
  });
  if (error) {
    console.error("original recipe insert failed", error);
    return { ok: false, message: "We made a recipe but couldn't save it. Try again." };
  }
  await db.from("saved_recipes").upsert({ user_id: userId, recipe_id: id });
  return { ok: true, slug, id };
}

/**
 * "Build a plate": Claude writes a recipe from the cook's picks. Same limits as other originals
 * (Plus 15 a day, free accounts 1 try) and saved the same way, styled "Build-a-plate" (public, no person named).
 */
export async function createBuilt(input: { userId: string; plus: boolean; build: Build }): Promise<{ ok: true; slug: string; id: string } | { ok: false; message: string }> {
  const b = input.build;
  const made = await originalCall(
    input,
    "You've used your free try. Yumjack Plus builds new recipes with you every day.",
    "Couldn't write that recipe just now. Try again.",
    () =>
      buildRecipe({
        summary: describeBuild(b),
        method: METHOD_BY_ID[b.method]!.label,
        servings: b.servings,
        addIns: b.addIns,
        sides: b.sides,
        note: b.note,
      }),
  );
  if (!made.ok) return made;
  const { result } = made.made;
  return saveOriginal(input.userId, result, { style: "Build-a-plate", inspiredBy: null });
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
  const v = VERSIONS[input.kind];
  const made = await originalCall(
    input,
    "You've used your free try. Yumjack Plus makes any recipe your way, every day.",
    "Couldn't make that version just now. Try again.",
    () =>
      adaptRecipe({
        dish: input.root.dish,
        restaurant: input.root.restaurant,
        servings: input.root.servings,
        ingredients: input.root.ingredients,
        steps: input.root.steps,
        brief: v.brief,
        label: v.label.toLowerCase(),
      }),
  );
  if (!made.ok) return made;
  const { result } = made.made;

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
    is_public: true, // only public recipes get versions (checked in makeVersion)
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
