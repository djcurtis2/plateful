// Daily games rules (Guess the Dish, Higher or Lower, Cooking Bingo). Pure; covered by games.test.ts.
// See docs/games.md. Points stay small on purpose: games reward the daily habit, cooking stays the main way to level up.

import { addDays } from "./trivia.ts";

export type GameId = "guess_dish" | "higher_lower";

// ---------------------------------------------------------------------------
// Seeded randomness: the same day gives everyone the same puzzle.

/** FNV-1a 32-bit hash of a string. */
export function hashSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Small deterministic PRNG (mulberry32): returns numbers in [0, 1). */
export function seededRand(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  const rand = seededRand(hashSeed(seed));
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function shortDate(day: string) {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

// ---------------------------------------------------------------------------
// Guess the Dish

export const DISH_MAX_GUESSES = 6;
export const DISH_CHOICES = 40;

/** How zoomed and blurred the photo is after `misses` wrong guesses (fully clear once the game is over). */
export function dishView(misses: number, over: boolean): { scale: number; blur: number } {
  const steps = [
    { scale: 3.4, blur: 14 },
    { scale: 2.7, blur: 10 },
    { scale: 2.1, blur: 7 },
    { scale: 1.6, blur: 4 },
    { scale: 1.25, blur: 2 },
    { scale: 1.08, blur: 0.5 },
  ];
  return over ? { scale: 1, blur: 0 } : steps[Math.min(misses, steps.length - 1)];
}

export type DishHintInfo = { cuisine: string | null; meal: string | null; label: string | null };

/** Hints unlocked so far: cuisine after 2 misses, meal after 3, label (restaurant or style) after 4. */
export function dishHints(misses: number, info: DishHintInfo): { name: string; value: string }[] {
  const hints: { name: string; value: string }[] = [];
  if (misses >= 2 && info.cuisine) hints.push({ name: "Cuisine", value: info.cuisine });
  if (misses >= 3 && info.meal) hints.push({ name: "Meal", value: info.meal });
  if (misses >= 4 && info.label) hints.push({ name: "Label", value: info.label });
  return hints;
}

export function sameDish(a: string, b: string) {
  const n = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return n(a) === n(b);
}

export const DISH_MAX_POINTS = 3;

/** 3 points for 1–2 guesses, 2 for 3–4, 1 for 5–6, nothing if unsolved. */
export function dishPoints(guesses: number, solved: boolean) {
  if (!solved) return 0;
  return guesses <= 2 ? 3 : guesses <= 4 ? 2 : 1;
}

/** "Dupe Kitchen · Guess the Dish · Nov 2 / 🟥🟥🟩 3/6": spoiler-free. */
export function dishShareText(day: string, results: boolean[], url: string) {
  const solved = results.at(-1) === true;
  return `Dupe Kitchen · Guess the Dish · ${shortDate(day)}\n${results.map((r) => (r ? "🟩" : "🟥")).join("")} ${solved ? results.length : "X"}/${DISH_MAX_GUESSES}\n${url}`;
}

// ---------------------------------------------------------------------------
// Higher or Lower

export const HL_DECK_SIZE = 30;
export const HL_POINTS_EVERY = 5;
export const HL_MAX_POINTS = 3;

export type HlGuess = "higher" | "lower";

/** Is the next dish higher or lower per plate than the current one? Ties count as right. */
export function hlRight(current: number, next: number, guess: HlGuess) {
  if (next === current) return true;
  return guess === "higher" ? next > current : next < current;
}

export function hlPoints(score: number) {
  return Math.min(HL_MAX_POINTS, Math.floor(score / HL_POINTS_EVERY));
}

export function hlShareText(day: string, score: number, perfect: boolean, url: string) {
  return `Dupe Kitchen · Higher or Lower · ${shortDate(day)}\n${perfect ? "🏆 a perfect run" : `🔥 ${score} in a row`}\n${url}`;
}

// ---------------------------------------------------------------------------
// Cooking Bingo (weekly)

/** Monday (UTC) of the week a day falls in, as YYYY-MM-DD. */
export function weekStart(day: string): string {
  const dow = new Date(`${day}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(day, -((dow + 6) % 7));
}

/** What someone did this week, counted on the server from their activity. */
export type BingoActivity = {
  cooked: number; // meals logged as cooked
  copycats: number; // cooked restaurant copycats
  cheapest: number | null; // lowest home cost per plate among cooked meals
  vegetarian: number; // cooked meals tagged vegetarian
  cuisines: number; // distinct cuisines cooked
  versions: number; // "Make it my way" versions made
  originals: number; // leftover recipes made
  entries: number; // cook-off entries posted
  votes: number; // cook-off votes cast
  triviaDays: number; // trivia days finished
  snaps: number; // dishes snapped
  saved: number; // dollars saved vs eating out
  plans: number; // weekly plans made
};

export const BINGO_SQUARES = [
  { id: "cook", label: "Cook a meal at home", href: "/library", done: (a: BingoActivity) => a.cooked >= 1 },
  { id: "copycat", label: "Cook a restaurant copycat", href: "/", done: (a: BingoActivity) => a.copycats >= 1 },
  { id: "under3", label: "Cook a plate under $3", href: "/library?sort=cheapest", done: (a: BingoActivity) => a.cheapest != null && a.cheapest < 3 },
  { id: "veg", label: "Cook something vegetarian", href: "/library?diet=vegetarian", done: (a: BingoActivity) => a.vegetarian >= 1 },
  { id: "cuisines", label: "Cook two different cuisines", href: "/library", done: (a: BingoActivity) => a.cuisines >= 2 },
  { id: "version", label: "Make a recipe your way", href: "/library", done: (a: BingoActivity) => a.versions >= 1 },
  { id: "leftovers", label: "Make a recipe from leftovers", href: "/library", done: (a: BingoActivity) => a.originals >= 1 },
  { id: "entry", label: "Post a cook-off entry", href: "/cookoff", done: (a: BingoActivity) => a.entries >= 1 },
  { id: "vote", label: "Vote in the cook-off", href: "/cookoff", done: (a: BingoActivity) => a.votes >= 1 },
  { id: "trivia", label: "Play trivia 3 days", href: "/trivia", done: (a: BingoActivity) => a.triviaDays >= 3 },
  { id: "snap", label: "Snap a new dish", href: "/", done: (a: BingoActivity) => a.snaps >= 1 },
  { id: "save20", label: "Save $20 vs eating out", href: "/account#savings", done: (a: BingoActivity) => a.saved >= 20 },
  { id: "plan", label: "Plan your week", href: "/plan", done: (a: BingoActivity) => a.plans >= 1 },
] as const;
export type BingoSquare = (typeof BINGO_SQUARES)[number];
export const BINGO_FREE = "free";

/** This week's card: 8 squares (same for everyone) around a free centre. */
export function bingoCard(week: string): (BingoSquare | typeof BINGO_FREE)[] {
  const picked = seededShuffle(BINGO_SQUARES, `bingo:${week}`).slice(0, 8);
  return [...picked.slice(0, 4), BINGO_FREE, ...picked.slice(4)];
}

export const BINGO_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
] as const;
export const BINGO_LINE_POINTS = 3;
export const BINGO_FULL_POINTS = 10;

export function bingoMarks(card: ReturnType<typeof bingoCard>, a: BingoActivity): boolean[] {
  return card.map((sq) => sq === BINGO_FREE || sq.done(a));
}

/** Indexes (into BINGO_LINES) of every completed line. */
export function bingoLines(marks: boolean[]): number[] {
  return BINGO_LINES.flatMap((line, i) => (line.every((s) => marks[s]) ? [i] : []));
}

export function bingoShareText(week: string, marks: boolean[], url: string) {
  const rows = [0, 3, 6].map((r) => marks.slice(r, r + 3).map((m, i) => (r + i === 4 ? "⭐" : m ? "🟩" : "⬜")).join(""));
  const lines = bingoLines(marks).length;
  return `Dupe Kitchen · Cooking Bingo · week of ${shortDate(week)}\n${rows.join("\n")}\n${marks.every(Boolean) ? "Full card!" : `${lines} ${lines === 1 ? "line" : "lines"}`}\n${url}`;
}
