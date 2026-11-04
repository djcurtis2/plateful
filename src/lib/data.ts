import "server-only";
import { admin, publicImageUrl } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { hasPlus, type ProfilePlanFields } from "@/lib/plan";
import type { Ingredient, Recipe } from "@/lib/recipe";
import { chefCards, type ChefCard } from "@/lib/avatar-server";
import { CLUB_MIN_MEMBERS } from "@/lib/clubs";
import { legacySlots, normalizeSettings, type PlanSettings, type PlanSlot } from "@/lib/planner";

type RecipeRow = Omit<Recipe, "image_url" | "menu_price" | "plate_cost" | "out_price"> & {
  out_price: string | number | null;
  image_path: string | null;
  menu_price: string | number | null;
  plate_cost: string | number | null;
  user_id: string | null;
};

const RECIPE_COLUMNS =
  "id, slug, dish, restaurant, cuisine, meals, out_price, menu_serves, contains, diet_tags, variant_of, variant_kind, source, style, servings, minutes, difficulty, confidence, why, menu_price, plate_cost, ingredients, steps, image_path, created_at, user_id";

export function toRecipe(row: RecipeRow): Recipe {
  return {
    id: row.id,
    slug: row.slug,
    dish: row.dish,
    restaurant: row.restaurant,
    cuisine: row.cuisine,
    meals: (row.meals ?? []) as Recipe["meals"],
    source: row.source === "leftovers" || row.source === "own" ? row.source : "snap",
    style: row.style === "Plateful kitchen" ? "House style" : (row.style ?? null), // old name for "Surprise me" recipes
    servings: row.servings,
    minutes: row.minutes,
    difficulty: row.difficulty,
    confidence: row.confidence,
    why: row.why,
    menu_price: row.menu_price == null ? null : Number(row.menu_price),
    plate_cost: row.plate_cost == null ? null : Number(row.plate_cost),
    out_price: row.out_price == null ? null : Number(row.out_price),
    menu_serves: Math.max(1, Number(row.menu_serves ?? 1)),
    contains: row.contains ?? [],
    diet_tags: (row.diet_tags ?? []) as Recipe["diet_tags"],
    variant_of: row.variant_of ?? null,
    variant_kind: row.variant_kind ?? null,
    ingredients: (row.ingredients ?? []) as Ingredient[],
    steps: (row.steps ?? []) as string[],
    image_url: publicImageUrl("dishes", row.image_path),
    created_at: row.created_at,
  };
}

export async function getRecipeBySlug(slug: string): Promise<Recipe | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("recipes").select(RECIPE_COLUMNS).eq("slug", slug).maybeSingle();
  return data ? toRecipe(data as RecipeRow) : null;
}

export async function getRecentPublicRecipes(limit = 12): Promise<Recipe[]> {
  const { data } = await admin()
    .from("recipes")
    .select(RECIPE_COLUMNS)
    .eq("is_public", true)
    .not("menu_price", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as RecipeRow[]).map(toRecipe);
}

/** Recipes to suggest from: recent public copycats plus your own saved ones. */
export async function getSuggestionPool(userId: string | null, limit = 300): Promise<Recipe[]> {
  const [{ data: pub }, mine] = await Promise.all([
    admin().from("recipes").select(RECIPE_COLUMNS).eq("is_public", true).order("created_at", { ascending: false }).limit(limit),
    userId ? getSavedRecipes(userId) : Promise.resolve([]),
  ]);
  return [...mine.map((m) => m.recipe), ...((pub ?? []) as RecipeRow[]).map(toRecipe)];
}

export type Profile = ProfilePlanFields & {
  id: string;
  display_name: string | null;
  referral_code: string;
  stripe_customer_id: string | null;
  current_period_end: string | null;
  public_name: string | null;
  is_admin: boolean;
  feature_me: boolean;
  diets: string[];
  avatar: unknown;
  gear_seen: string[];
  clubs: string[];
};

export async function getMe() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, referral_code, plan, subscription_status, bonus_until, stripe_customer_id, current_period_end, public_name, is_admin, feature_me, diets, avatar, gear_seen, clubs")
    .eq("id", user.id)
    .maybeSingle();
  const profile = data as Profile | null;
  return { user, profile, plus: hasPlus(profile) };
}

export async function getPantry(userId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("pantry_items").select("name").eq("user_id", userId).order("name");
  return ((data ?? []) as { name: string }[]).map((r) => r.name);
}

export async function getSavedRecipes(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("saved_recipes")
    .select(`cooked_at, created_at, recipes (${RECIPE_COLUMNS})`)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return ((data ?? []) as unknown as { cooked_at: string | null; created_at: string; recipes: RecipeRow | null }[])
    .filter((r) => r.recipes)
    .map((r) => ({ cookedAt: r.cooked_at, savedAt: r.created_at, recipe: toRecipe(r.recipes as RecipeRow) }));
}

export async function isSaved(userId: string, recipeId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("saved_recipes")
    .select("recipe_id, cooked_at")
    .eq("user_id", userId)
    .eq("recipe_id", recipeId)
    .maybeSingle();
  return { saved: !!data, cooked: !!(data as { cooked_at: string | null } | null)?.cooked_at };
}

export type Attempt = {
  id: string;
  user_id: string;
  recipe_id: string;
  challenge_id: string | null;
  image_url: string;
  caption: string | null;
  votes: number;
  created_at: string;
  name: string | null; // public name of the cook; null = "A Yumjack cook"
  chef: ChefCard;
  cost_per_plate: number | null;
  cost_source: "self" | "receipt" | null;
  receipt_store: string | null;
  receipt_verified_at: string | null;
  minutes: number | null;
  swaps: string | null;
  notes: string | null;
};

const ATTEMPT_COLUMNS =
  "id, user_id, recipe_id, challenge_id, image_path, caption, votes, created_at, cost_per_plate, cost_source, receipt_store, receipt_verified_at, minutes, swaps, notes";
type AttemptRow = Omit<Attempt, "image_url" | "name" | "chef" | "cost_per_plate"> & { image_path: string; cost_per_plate: string | number | null };

async function withNames(rows: AttemptRow[]): Promise<Attempt[]> {
  const chefs = await chefCards(rows.map((r) => r.user_id));
  return rows.map(({ image_path, cost_per_plate, ...a }) => ({
    ...a,
    cost_per_plate: cost_per_plate == null ? null : Number(cost_per_plate),
    image_url: publicImageUrl("attempts", image_path)!,
    name: chefs[a.user_id]?.name ?? null,
    chef: chefs[a.user_id],
  }));
}

export async function getAttempts(filter: { recipeId?: string; challengeId?: string }, limit = 60): Promise<Attempt[]> {
  let q = admin().from("attempts").select(ATTEMPT_COLUMNS).eq("hidden", false).limit(limit);
  if (filter.recipeId) q = q.eq("recipe_id", filter.recipeId).order("created_at", { ascending: false });
  if (filter.challengeId) q = q.eq("challenge_id", filter.challengeId).order("votes", { ascending: false });
  const { data } = await q;
  return withNames((data ?? []) as AttemptRow[]);
}

export async function getAttempt(id: string): Promise<Attempt | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await admin().from("attempts").select(ATTEMPT_COLUMNS).eq("id", id).eq("hidden", false).maybeSingle();
  if (!data) return null;
  return (await withNames([data as AttemptRow]))[0];
}

/** Attempt ids this person has voted for in a cook-off. */
export async function myVotes(userId: string, challengeId: string): Promise<string[]> {
  const { data } = await admin().from("attempt_votes").select("attempt_id").eq("user_id", userId).eq("challenge_id", challengeId);
  return (data ?? []).map((v) => v.attempt_id);
}

export type Challenge = {
  id: string;
  slug: string;
  title: string;
  blurb: string | null;
  starts_at: string;
  ends_at: string;
  finalized_at: string | null;
  chef_pick_attempt_id: string | null;
  crowd_winner_attempt_id: string | null;
  thriftiest_attempt_id: string | null;
  /** The real restaurant dish voters compare against; falls back to the recipe's snapped photo. */
  reference_image_url: string | null;
  recipe: Recipe;
};

const CHALLENGE_COLUMNS = `id, slug, title, blurb, starts_at, ends_at, finalized_at, chef_pick_attempt_id, crowd_winner_attempt_id, thriftiest_attempt_id, reference_image_path, recipes (${RECIPE_COLUMNS})`;

function toChallenge(data: unknown): Challenge {
  const row = data as Omit<Challenge, "recipe" | "reference_image_url"> & { recipes: RecipeRow; reference_image_path: string | null };
  const { recipes, reference_image_path, ...rest } = row;
  const recipe = toRecipe(recipes);
  return { ...rest, recipe, reference_image_url: publicImageUrl("dishes", reference_image_path) ?? recipe.image_url };
}

export function isLive(c: Pick<Challenge, "ends_at" | "finalized_at">, now = new Date()) {
  return !c.finalized_at && new Date(c.ends_at) > now;
}

/** The live cook-off, or the most recent one if none is running (so its results stay up). */
export async function getCurrentChallenge(): Promise<Challenge | null> {
  const { data } = await admin()
    .from("challenges")
    .select(CHALLENGE_COLUMNS)
    .lte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? toChallenge(data) : null;
}

export async function getChallengeBySlug(slug: string): Promise<Challenge | null> {
  const { data } = await admin().from("challenges").select(CHALLENGE_COLUMNS).eq("slug", slug).maybeSingle();
  return data ? toChallenge(data) : null;
}

export async function getChallengeById(id: string): Promise<Challenge | null> {
  const { data } = await admin().from("challenges").select(CHALLENGE_COLUMNS).eq("id", id).maybeSingle();
  return data ? toChallenge(data) : null;
}

export async function getPastChallenges(): Promise<Challenge[]> {
  const { data } = await admin()
    .from("challenges")
    .select(CHALLENGE_COLUMNS)
    .lte("ends_at", new Date().toISOString())
    .order("ends_at", { ascending: false })
    .limit(52);
  return (data ?? []).map(toChallenge);
}

export async function getUpcomingChallenge(): Promise<Challenge | null> {
  const { data } = await admin()
    .from("challenges")
    .select(CHALLENGE_COLUMNS)
    .gt("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data ? toChallenge(data) : null;
}

/** Recipes saved before Yumjack asked for package sizes (admin backfill). */
export async function recipesMissingPackSizes() {
  const { data } = await admin().from("recipes").select("id, ingredients").order("created_at", { ascending: false }).limit(1000);
  return ((data ?? []) as { id: string; ingredients: unknown }[]).filter((r) => (r.ingredients as Ingredient[]).some((g) => g.pack_qty === undefined));
}

/** Recipes by id, in the order given (missing ones dropped). */
export async function getRecipesByIds(ids: string[]): Promise<Recipe[]> {
  if (!ids.length) return [];
  const { data } = await admin().from("recipes").select(RECIPE_COLUMNS).in("id", ids);
  const byId = new Map(((data ?? []) as RecipeRow[]).map((r) => [r.id, toRecipe(r)]));
  return ids.map((id) => byId.get(id)).filter((r): r is Recipe => !!r);
}

/** Public recipes a club's members cook and save most. Counts only. Empty list if the SQL function isn't installed yet. */
export async function clubPopular(clubId: string, limit = 12): Promise<{ recipe: Recipe; members: number }[]> {
  const { data, error } = await admin().rpc("club_popular", { club: clubId, max_rows: limit });
  if (error) {
    console.error("club_popular failed", error.message);
    return [];
  }
  const rows = (data ?? []) as { recipe_id: string; members: number }[];
  const recipes = await getRecipesByIds(rows.map((r) => r.recipe_id));
  const byId = new Map(recipes.map((r) => [r.id, r]));
  return rows.flatMap((r) => {
    const recipe = byId.get(r.recipe_id);
    // The SQL already requires this; checked again so an older function version never leaks one person's history.
    return recipe && r.members >= CLUB_MIN_MEMBERS ? [{ recipe, members: r.members }] : [];
  });
}

/** Recent cook-off entries from a club's members (two queries: members, then their attempts). */
export async function clubEntries(clubId: string, limit = 12): Promise<Attempt[]> {
  const { data: members } = await admin().from("profiles").select("id").contains("clubs", [clubId]).limit(500);
  const ids = (members ?? []).map((m) => m.id);
  if (!ids.length) return [];
  const { data } = await admin().from("attempts").select(ATTEMPT_COLUMNS).eq("hidden", false).in("user_id", ids).order("created_at", { ascending: false }).limit(limit);
  return withNames((data ?? []) as AttemptRow[]);
}

/** legacy = an older dinners-only plan with no stored spots yet; its spots come from recipe_ids. */
export type MealPlanRow = { id: string; settings: PlanSettings; slots: PlanSlot[]; legacy: boolean; swapped: string[]; created_at: string };

/** This person's most recent meal plan. */
export async function getLatestPlan(userId: string): Promise<MealPlanRow | null> {
  const { data } = await admin()
    .from("meal_plans")
    .select("id, settings, recipe_ids, slots, swapped, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const slots = data.slots as PlanSlot[] | null;
  return {
    id: data.id,
    settings: normalizeSettings(data.settings as Partial<PlanSettings>),
    slots: slots ?? legacySlots(data.recipe_ids),
    legacy: !slots,
    swapped: data.swapped,
    created_at: data.created_at,
  };
}

/** Someone's own recipe opened from its share link. Null unless the token matches a recipe still being shared. */
export async function getSharedRecipe(slug: string, token: string): Promise<Recipe | null> {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return null;
  const { data } = await admin().from("recipes").select(RECIPE_COLUMNS).eq("slug", slug).eq("source", "own").eq("share_token", token).maybeSingle();
  return data ? toRecipe(data as RecipeRow) : null;
}

/** The owner's current share link token for their own recipe, if it's being shared. */
export async function getShareToken(userId: string, recipeId: string): Promise<string | null> {
  const { data } = await admin().from("recipes").select("share_token").eq("id", recipeId).eq("user_id", userId).maybeSingle();
  return data?.share_token ?? null;
}

/** A recipe this person may put in their week: any public recipe, or one of their own private ones. */
export async function getUsableRecipe(userId: string, id: string): Promise<Recipe | null> {
  const { data } = await admin().from("recipes").select(RECIPE_COLUMNS).eq("id", id).or(`is_public.eq.true,user_id.eq.${userId}`).maybeSingle();
  return data ? toRecipe(data as RecipeRow) : null;
}

/** Recipes that haven't been checked for diet tags yet (admin backfill). */
export async function recipesMissingDietTags() {
  const { data } = await admin().from("recipes").select("id, dish, servings, ingredients").filter("contains", "eq", "{}").filter("diet_tags", "eq", "{}").limit(1000);
  return (data ?? []) as { id: string; dish: string; servings: number; ingredients: unknown }[];
}

/** "Make it my way" versions of a recipe (or of its original, if it is itself a version). */
export async function getVersions(rootId: string): Promise<Recipe[]> {
  const { data } = await admin().from("recipes").select(RECIPE_COLUMNS).eq("variant_of", rootId).order("created_at", { ascending: true });
  return ((data ?? []) as RecipeRow[]).map(toRecipe);
}
