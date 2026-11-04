// Daily cooking trivia rules. Pure functions, shared by server and client; covered by trivia.test.ts.
// Points stay small on purpose: trivia rewards the daily habit, cooking stays the main way to level up.

import { z } from "zod";
import { POINTS } from "./game.ts";

export const TRIVIA_PER_DAY = 3;
/** Every 7th day in a row earns a bonus on top of the answers. */
export const TRIVIA_STREAK_EVERY = 7;
export const TRIVIA_STREAK_BONUS = 5;

/** The trivia day (UTC), as YYYY-MM-DD. Everyone gets the same questions on the same day. */
export function triviaDay(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return triviaDay(d);
}

/**
 * Days played in a row, counting back from today.
 * Not having played yet today doesn't break it: yesterday's streak is still alive until midnight UTC.
 */
export function triviaStreak(playedDays: Iterable<string>, today: string): number {
  const played = new Set(playedDays);
  let day = played.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (played.has(day)) {
    streak++;
    day = addDays(day, -1);
  }
  return streak;
}

/** Points for a finished day: one per right answer, plus the bonus on every 7th day in a row. */
export function triviaPoints(correct: number, streak: number) {
  const answers = Math.max(0, Math.min(TRIVIA_PER_DAY, correct)) * POINTS.trivia;
  const bonus = streak > 0 && streak % TRIVIA_STREAK_EVERY === 0 ? TRIVIA_STREAK_BONUS : 0;
  return { answers, bonus, total: answers + bonus };
}

/** "Yumjack trivia · Nov 2 / 🟩🟥🟩 2/3": spoiler-free, like a word-game result. */
export function triviaShareText(day: string, results: boolean[], url: string): string {
  const date = new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const right = results.filter(Boolean).length;
  return `Yumjack trivia · ${date}\n${results.map((r) => (r ? "🟩" : "🟥")).join("")} ${right}/${results.length}\n${url}`;
}

/** Moves the right answer to a random slot (models tend to put it in the same place). */
export function shuffleChoices(choices: string[], answer: number, rand = Math.random) {
  const order = choices.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return { choices: order.map((i) => choices[i]), answer: order.indexOf(answer) };
}

/** One question as Claude drafts it, checked before it's stored. */
export const TriviaDraftSchema = z
  .object({
    question: z.string().trim().min(10).max(200),
    choices: z.array(z.string().trim().min(1).max(80)).length(4),
    answer_index: z.number().int().min(0).max(3),
    why: z.string().trim().min(10).max(220),
  })
  .refine((q) => new Set(q.choices.map((c) => c.toLowerCase())).size === 4, "choices must differ");
export type TriviaDraft = z.infer<typeof TriviaDraftSchema>;

/** JSON schema for Claude's structured output: a list of days, each with three questions. */
export const triviaOutputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["days"],
  properties: {
    days: {
      type: "array",
      description: "One entry per requested day, in order.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["questions"],
        properties: {
          questions: {
            type: "array",
            description: `Exactly ${TRIVIA_PER_DAY} questions, easiest first.`,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["question", "choices", "answer_index", "why"],
              properties: {
                question: { type: "string", description: "10 to 160 characters, one clear question." },
                choices: { type: "array", items: { type: "string" }, description: "Exactly 4 short, distinct options (under 60 characters each)." },
                answer_index: { type: "integer", description: "Index 0 to 3 of the one correct choice." },
                why: { type: "string", description: "One friendly sentence (under 200 characters) explaining the answer, ideally with a tip a home cook can use." },
              },
            },
          },
        },
      },
    },
  },
} as const;
