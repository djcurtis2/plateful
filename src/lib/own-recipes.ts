import "server-only";
import { admin } from "@/lib/supabase/admin";
import { priceOwnRecipe } from "@/lib/claude";
import { OWN_SCAN, recordScan, siteCapReached } from "@/lib/limits";
import { slugify, type Meal } from "@/lib/recipe";
import { dietTagsFrom } from "@/lib/diet";

/** Own recipes Claude prices per person per day. Free for everyone; the cap only protects the bill. */
export const OWN_RECIPES_PER_DAY = 10;

export async function ownRecipesLeft(userId: string): Promise<number> {
  const { count } = await admin()
    .from("scans")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("ip_hash", OWN_SCAN)
    .not("input_tokens", "is", null)
    .gte("created_at", new Date(Date.now() - 86_400_000).toISOString());
  return Math.max(0, OWN_RECIPES_PER_DAY - (count ?? 0));
}

/**
 * Saves a cook's own recipe, priced by Claude so it can join a week's shopping list.
 * Private: only its owner sees it (is_public false), and it's added to their library.
 */
export async function createOwnRecipe(input: {
  userId: string;
  dish: string;
  meals: Meal[];
  servings: number;
  minutes: number | null;
  ingredients: string[];
  steps: string[];
}): Promise<{ ok: true; slug: string; id: string } | { ok: false; message: string }> {
  if (await siteCapReached()) return { ok: false, message: "We've hit today's limit while we scale up. Try again tomorrow." };
  if ((await ownRecipesLeft(input.userId)) <= 0) return { ok: false, message: `That's ${OWN_RECIPES_PER_DAY} of your own recipes today. More tomorrow.` };
  let made;
  try {
    made = await priceOwnRecipe({ dish: input.dish, servings: input.servings, ingredients: input.ingredients, steps: input.steps });
  } catch (e) {
    console.error("own recipe failed", e);
    await recordScan({ userId: input.userId, visitorId: null, ipHash: OWN_SCAN, ok: false });
    return { ok: false, message: "Couldn't price your recipe just now. Try again." };
  }
  const { result, inputTokens, outputTokens } = made;
  await recordScan({ userId: input.userId, visitorId: null, ipHash: OWN_SCAN, ok: true, inputTokens, outputTokens });

  const db = admin();
  const id = crypto.randomUUID();
  const slug = `${slugify(input.dish)}-${id.slice(0, 6)}`;
  const contains = result.contains ?? [];
  const { error } = await db.from("recipes").insert({
    id,
    slug,
    user_id: input.userId,
    dish: input.dish,
    restaurant: null,
    cuisine: result.cuisine || null,
    meals: input.meals,
    servings: input.servings,
    minutes: input.minutes ?? result.minutes ?? null,
    difficulty: result.difficulty ?? null,
    confidence: null,
    why: result.why ?? null,
    menu_price: null,
    plate_cost: result.plate_cost ?? null,
    out_price: result.out_price ?? null,
    contains,
    diet_tags: dietTagsFrom(contains, !!result.low_carb),
    ingredients: result.ingredients!,
    steps: result.steps!,
    image_path: null,
    source: "own",
    style: null,
    is_public: false,
  });
  if (error) {
    console.error("own recipe insert failed", error);
    return { ok: false, message: "We priced your recipe but couldn't save it. Try again." };
  }
  await db.from("saved_recipes").upsert({ user_id: input.userId, recipe_id: id });
  return { ok: true, slug, id };
}
