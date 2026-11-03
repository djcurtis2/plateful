import "server-only";
import { admin } from "@/lib/supabase/admin";
import { getRecipesByIds, getSuggestionPool } from "@/lib/data";
import { awardPoints, publicNames } from "@/lib/game-server";
import { MEAL_LABELS, menuPlate, recipeLabel, type Recipe } from "@/lib/recipe";
import { addDays } from "@/lib/trivia";
import {
  BINGO_FULL_POINTS,
  BINGO_LINE_POINTS,
  DISH_CHOICES,
  DISH_MAX_GUESSES,
  HL_DECK_SIZE,
  bingoCard,
  bingoLines,
  bingoMarks,
  dishHints,
  dishPoints,
  hashSeed,
  hlPoints,
  hlRight,
  sameDish,
  seededShuffle,
  type BingoActivity,
  type GameId,
  type HlGuess,
} from "@/lib/games";

// ---------------------------------------------------------------------------
// Shared: each day's puzzle is picked once and stored, so it never changes mid-day.

async function storedDay<T>(game: GameId, day: string, build: () => Promise<T | null>): Promise<T | null> {
  const db = admin();
  const { data } = await db.from("game_days").select("payload").eq("game", game).eq("day", day).maybeSingle();
  if (data) return data.payload as T;
  const payload = await build();
  if (!payload) return null;
  await db.from("game_days").upsert({ game, day, payload: payload as never }, { onConflict: "game,day", ignoreDuplicates: true });
  // Re-read: if another request stored first, everyone gets that one.
  const { data: again } = await db.from("game_days").select("payload").eq("game", game).eq("day", day).maybeSingle();
  return (again?.payload as T) ?? payload;
}

export async function gamePlay(userId: string, game: GameId, day: string) {
  const { data } = await admin()
    .from("game_plays")
    .select("picks, moves, score, solved, finished_at")
    .eq("user_id", userId)
    .eq("game", game)
    .eq("day", day)
    .maybeSingle();
  return data;
}

/** Saves a move only if nobody moved in between (two tabs can't double-play). Returns false on a race. */
async function saveMove(
  userId: string,
  game: GameId,
  day: string,
  prevMoves: number,
  fields: { picks: string[]; score: number; solved: boolean; finished: boolean },
) {
  const db = admin();
  const row = { picks: fields.picks, moves: prevMoves + 1, score: fields.score, solved: fields.solved, finished_at: fields.finished ? new Date().toISOString() : null };
  if (prevMoves === 0) {
    const { error } = await db.from("game_plays").insert({ user_id: userId, game, day, ...row });
    return !error;
  }
  const { data } = await db.from("game_plays").update(row).eq("user_id", userId).eq("game", game).eq("day", day).eq("moves", prevMoves).select("day");
  return !!data?.length;
}

/** Days finished in a row for a game, counting back from today (yesterday if today isn't done yet). */
export async function gameStreak(userId: string, game: GameId, today: string) {
  const { data } = await admin()
    .from("game_plays")
    .select("day")
    .eq("user_id", userId)
    .eq("game", game)
    .not("finished_at", "is", null)
    .gte("day", addDays(today, -400))
    .order("day", { ascending: false });
  const played = new Set((data ?? []).map((r) => r.day));
  let day = played.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (played.has(day)) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

const dishKey = (r: Pick<Recipe, "dish" | "restaurant">) => `${r.restaurant ?? ""}|${r.dish}`.toLowerCase();

/** Public recipes, one per dish, not versions. */
async function gamePool() {
  const seen = new Set<string>();
  return (await getSuggestionPool(null, 500)).filter((r) => !r.variant_of && !seen.has(dishKey(r)) && seen.add(dishKey(r)));
}

// ---------------------------------------------------------------------------
// Guess the Dish

type DishDay = { recipe_id: string; choices: string[] };

/** Today's dish (answer included: server only) and the list of names to guess from. */
export async function dishOfDay(day: string): Promise<{ recipe: Recipe; choices: string[] } | null> {
  const payload = await storedDay<DishDay>("guess_dish", day, async () => {
    const pool = (await gamePool()).filter((r) => r.image_url);
    if (pool.length < 4) return null;
    // Skip dishes used in the last 30 days.
    const { data: recent } = await admin().from("game_days").select("payload").eq("game", "guess_dish").gte("day", addDays(day, -30));
    const used = new Set((recent ?? []).map((r) => (r.payload as DishDay).recipe_id));
    const fresh = pool.filter((r) => !used.has(r.id));
    const from = (fresh.length ? fresh : pool).sort((a, b) => a.id.localeCompare(b.id));
    const answer = from[hashSeed(`dish:${day}`) % from.length];
    // Other names: distinct dish names from every public recipe (photo or not), so the list is long.
    const names = [...new Set((await gamePool()).map((r) => r.dish).filter((d) => !sameDish(d, answer.dish)))];
    const others = seededShuffle(names, `dish-choices:${day}`).slice(0, DISH_CHOICES - 1);
    return { recipe_id: answer.id, choices: [answer.dish, ...others].sort((a, b) => a.localeCompare(b)) };
  });
  if (!payload) return null;
  const [recipe] = await getRecipesByIds([payload.recipe_id]);
  return recipe ? { recipe, choices: payload.choices } : null;
}

export function dishHintInfo(r: Recipe) {
  const meal = r.meals.includes("dinner") ? "dinner" : r.meals[0];
  return { cuisine: r.cuisine, meal: meal ? MEAL_LABELS[meal] : null, label: recipeLabel(r) };
}

export type DishState = {
  guesses: string[];
  results: boolean[];
  solved: boolean;
  over: boolean;
  hints: { name: string; value: string }[];
  reveal: { dish: string; slug: string; label: string | null } | null;
  points: number;
};

export function dishState(recipe: Recipe, guesses: string[]): DishState {
  const results = guesses.map((g) => sameDish(g, recipe.dish));
  const solved = results.includes(true);
  const over = solved || guesses.length >= DISH_MAX_GUESSES;
  const misses = results.filter((r) => !r).length;
  return {
    guesses,
    results,
    solved,
    over,
    hints: dishHints(misses, dishHintInfo(recipe)),
    reveal: over ? { dish: recipe.dish, slug: recipe.slug, label: recipeLabel(recipe) } : null,
    points: over ? dishPoints(guesses.length, solved) : 0,
  };
}

/**
 * One guess. Signed-in: saved in order, once; points on finishing. Guests: worked out from the guesses
 * they send (nothing saved, no points).
 */
export async function guessDish(userId: string | null, day: string, guess: string, guestGuesses: string[]): Promise<DishState | { error: string }> {
  const today = await dishOfDay(day);
  if (!today) return { error: "Today's dish isn't ready yet." };
  const pick = today.choices.find((c) => sameDish(c, guess));
  if (!pick) return { error: "Pick a dish from the list." };

  if (!userId) {
    const prior = guestGuesses.filter((g) => today.choices.some((c) => sameDish(c, g))).slice(0, DISH_MAX_GUESSES);
    if (dishState(today.recipe, prior).over) return dishState(today.recipe, prior);
    if (prior.some((g) => sameDish(g, pick))) return { error: "You already guessed that one." };
    return dishState(today.recipe, [...prior, pick]);
  }

  const play = await gamePlay(userId, "guess_dish", day);
  const prior = play?.picks ?? [];
  const before = dishState(today.recipe, prior);
  if (before.over) return before;
  if (prior.some((g) => sameDish(g, pick))) return { error: "You already guessed that one." };
  const after = dishState(today.recipe, [...prior, pick]);
  const ok = await saveMove(userId, "guess_dish", day, play?.moves ?? 0, {
    picks: after.guesses,
    score: after.points,
    solved: after.solved,
    finished: after.over,
  });
  if (!ok) return { error: "That guess didn't save. Reload the page and carry on." };
  if (after.over) await awardPoints(userId, "game", after.points, `dish:${day}`);
  return after;
}

// ---------------------------------------------------------------------------
// Higher or Lower

type HlDay = { ids: string[] };
export type HlCard = { dish: string; restaurant: string | null; image_url: string | null; slug: string };

/** Today's deck: copycats with a menu price, shuffled by the day (same for everyone). */
export async function hlDeck(day: string): Promise<Recipe[] | null> {
  const payload = await storedDay<HlDay>("higher_lower", day, async () => {
    const pool = (await gamePool()).filter((r) => r.restaurant && menuPlate(r) && r.plate_cost);
    if (pool.length < 4) return null;
    const ids = seededShuffle(
      pool.map((r) => r.id).sort(),
      `hl:${day}`,
    ).slice(0, HL_DECK_SIZE);
    return { ids };
  });
  if (!payload) return null;
  const deck = await getRecipesByIds(payload.ids);
  return deck.length >= 2 ? deck : null;
}

export function hlCard(r: Recipe): HlCard {
  return { dish: r.dish, restaurant: r.restaurant, image_url: r.image_url, slug: r.slug };
}

export type HlState = { index: number; score: number; over: boolean; perfect: boolean; points: number };

/** Replays a list of guesses against the deck. `index` is the card you're comparing from. */
export function hlReplay(deck: Recipe[], guesses: HlGuess[]): HlState & { lastRight: boolean | null } {
  let index = 0;
  let score = 0;
  let over = false;
  let lastRight: boolean | null = null;
  for (const g of guesses) {
    if (over) break;
    const right = hlRight(menuPlate(deck[index])!, menuPlate(deck[index + 1])!, g);
    lastRight = right;
    if (right) {
      score++;
      index++;
      if (index >= deck.length - 1) over = true; // ran out of cards: a perfect run
    } else over = true;
  }
  const perfect = over && score === deck.length - 1;
  return { index, score, over, perfect, points: over ? hlPoints(score) : 0, lastRight };
}

/** One guess: is the next card higher or lower per plate? Returns the revealed price and the new state. */
export async function guessHl(userId: string | null, day: string, guess: HlGuess, guestGuesses: HlGuess[]) {
  const deck = await hlDeck(day);
  if (!deck) return { error: "Today's game isn't ready yet." } as const;

  let prior: HlGuess[];
  let moves = 0;
  if (userId) {
    const play = await gamePlay(userId, "higher_lower", day);
    prior = (play?.picks ?? []) as HlGuess[];
    moves = play?.moves ?? 0;
  } else prior = guestGuesses.filter((g) => g === "higher" || g === "lower").slice(0, HL_DECK_SIZE);

  const before = hlReplay(deck, prior);
  if (before.over) return { error: "This run is over. Come back tomorrow for a new deck." } as const;
  const after = hlReplay(deck, [...prior, guess]);
  if (userId) {
    const ok = await saveMove(userId, "higher_lower", day, moves, { picks: [...prior, guess], score: after.score, solved: after.perfect, finished: after.over });
    if (!ok) return { error: "That guess didn't save. Reload the page and carry on." } as const;
    if (after.over) await awardPoints(userId, "game", after.points, `hl:${day}`);
  }
  const revealed = deck[before.index + 1];
  return {
    right: after.lastRight!,
    revealedPrice: menuPlate(revealed)!,
    state: after,
    // The next card to guess (price hidden), if the run goes on.
    next: after.over ? null : hlCard(deck[after.index + 1]),
  } as const;
}

/** Today's best runs. */
export async function hlLeaders(day: string, limit = 10) {
  const { data } = await admin()
    .from("game_plays")
    .select("user_id, score, finished_at")
    .eq("game", "higher_lower")
    .eq("day", day)
    .not("finished_at", "is", null)
    .order("score", { ascending: false })
    .order("finished_at", { ascending: true })
    .limit(limit);
  const names = await publicNames((data ?? []).map((r) => r.user_id));
  return (data ?? []).map((r, i) => ({ rank: i + 1, userId: r.user_id, score: r.score, name: names[r.user_id] ?? null }));
}

// ---------------------------------------------------------------------------
// Cooking Bingo

/** What someone did this week, from their activity. */
export async function bingoActivity(userId: string, week: string): Promise<BingoActivity> {
  const db = admin();
  const end = addDays(week, 7);
  const from = `${week}T00:00:00Z`;
  const to = `${end}T00:00:00Z`;
  const [cooks, entries, votes, trivia, mine, plans] = await Promise.all([
    db.from("cook_log").select("recipe_id, home_cost, servings, compare, saved").eq("user_id", userId).gte("cooked_on", week).lt("cooked_on", end),
    db.from("attempts").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", from).lt("created_at", to),
    db.from("attempt_votes").select("attempt_id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", from).lt("created_at", to),
    db.from("trivia_plays").select("day", { count: "exact", head: true }).eq("user_id", userId).not("finished_at", "is", null).gte("day", week).lt("day", end),
    db.from("recipes").select("source, variant_of").eq("user_id", userId).gte("created_at", from).lt("created_at", to),
    db.from("meal_plans").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", from).lt("created_at", to),
  ]);
  const cooked = cooks.data ?? [];
  const recipes = await getRecipesByIds([...new Set(cooked.map((c) => c.recipe_id))]);
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const perPlate = cooked.map((c) => Number(c.home_cost) / Math.max(1, c.servings));
  const made = mine.data ?? [];
  return {
    cooked: cooked.length,
    copycats: cooked.filter((c) => c.compare === "menu").length,
    cheapest: perPlate.length ? Math.min(...perPlate) : null,
    vegetarian: cooked.filter((c) => byId.get(c.recipe_id)?.diet_tags.includes("vegetarian")).length,
    cuisines: new Set(cooked.map((c) => byId.get(c.recipe_id)?.cuisine).filter(Boolean)).size,
    versions: made.filter((r) => r.variant_of).length,
    originals: made.filter((r) => r.source === "leftovers" && !r.variant_of).length,
    entries: entries.count ?? 0,
    votes: votes.count ?? 0,
    triviaDays: trivia.count ?? 0,
    snaps: made.filter((r) => r.source === "snap" && !r.variant_of).length,
    saved: cooked.reduce((s, c) => s + Number(c.saved), 0),
    plans: plans.count ?? 0,
  };
}

/** This week's card, ticks and lines; awards line and full-card points once each (idempotent). */
export async function bingoFor(userId: string | null, week: string) {
  const card = bingoCard(week);
  if (!userId) return { card, marks: card.map((c) => c === "free"), lines: [] as number[], earned: 0 };
  const marks = bingoMarks(card, await bingoActivity(userId, week));
  const lines = bingoLines(marks);
  for (const i of lines) await awardPoints(userId, "game", BINGO_LINE_POINTS, `bingo:${week}:line${i}`);
  if (marks.every(Boolean)) await awardPoints(userId, "game", BINGO_FULL_POINTS, `bingo:${week}:full`);
  const earned = lines.length * BINGO_LINE_POINTS + (marks.every(Boolean) ? BINGO_FULL_POINTS : 0);
  return { card, marks, lines, earned };
}
