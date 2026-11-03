"use server";
import { revalidatePath } from "next/cache";
import { getMe } from "@/lib/data";
import { guessDish, guessHl } from "@/lib/games-server";
import { triviaDay } from "@/lib/trivia";
import type { HlGuess } from "@/lib/games";

const NEW_DAY = "A new day's game just started. Reload to play it.";

/** Guess the Dish: one guess. Answers are checked here; the browser never gets the dish until the game is over. */
export async function submitDishGuess(day: string, guess: string, guestGuesses: string[] = []) {
  if (day !== triviaDay()) return { error: NEW_DAY };
  if (typeof guess !== "string" || guess.length > 120) return { error: "Pick a dish from the list." };
  const me = await getMe();
  const r = await guessDish(me?.user.id ?? null, day, guess, Array.isArray(guestGuesses) ? guestGuesses.slice(0, 6).map(String) : []);
  if (!("error" in r) && r.over && me) revalidatePath("/", "layout"); // header points
  return r;
}

/** Higher or Lower: one guess about the next card. */
export async function submitHlGuess(day: string, guess: HlGuess, guestGuesses: HlGuess[] = []) {
  if (day !== triviaDay()) return { error: NEW_DAY };
  if (guess !== "higher" && guess !== "lower") return { error: "Pick higher or lower." };
  const me = await getMe();
  const r = await guessHl(me?.user.id ?? null, day, guess, Array.isArray(guestGuesses) ? guestGuesses : []);
  if (!("error" in r) && r.state.over && me) revalidatePath("/", "layout");
  return r;
}
