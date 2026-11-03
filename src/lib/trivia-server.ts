import "server-only";
import { admin } from "@/lib/supabase/admin";
import { awardPoints } from "@/lib/game-server";
import { TRIVIA_PER_DAY, addDays, triviaPoints, triviaStreak } from "@/lib/trivia";

export type TriviaQuestion = { position: number; question: string; choices: string[]; answer: number; why: string };

/** A day's approved questions, in order. Fewer than three means the day isn't ready. Includes answers: server only. */
export async function triviaQuestions(day: string): Promise<TriviaQuestion[]> {
  const { data } = await admin()
    .from("trivia_questions")
    .select("position, question, choices, answer, why")
    .eq("day", day)
    .eq("status", "approved")
    .order("position");
  return data ?? [];
}

export async function triviaPlay(userId: string, day: string) {
  const { data } = await admin().from("trivia_plays").select("picks, correct, finished_at").eq("user_id", userId).eq("day", day).maybeSingle();
  return data;
}

/** Finished days in a row, counting back from today (yesterday if today isn't done yet). */
export async function triviaStreakFor(userId: string, today: string) {
  const { data } = await admin()
    .from("trivia_plays")
    .select("day")
    .eq("user_id", userId)
    .not("finished_at", "is", null)
    .gte("day", addDays(today, -400))
    .order("day", { ascending: false });
  return triviaStreak((data ?? []).map((r) => r.day), today);
}

/**
 * Saves one answer for a signed-in player, in order and only once.
 * Returns the picks so far, or null if the answer was out of order or raced another tab.
 * The last answer finishes the day and awards points (idempotent, like every award).
 */
export async function recordTriviaPick(userId: string, day: string, position: number, choice: number, questions: TriviaQuestion[]) {
  const db = admin();
  const play = await triviaPlay(userId, day);
  const picks = play?.picks ?? [];
  if (picks.length >= position) return { picks, finished: null }; // already answered: show what they picked
  if (picks.length !== position - 1) return null;

  const next = [...picks, choice];
  const correct = next.filter((p, i) => questions[i]?.answer === p).length;
  const last = next.length === TRIVIA_PER_DAY;
  const fields = { picks: next, correct, finished_at: last ? new Date().toISOString() : null };
  if (!play) {
    const { error } = await db.from("trivia_plays").insert({ user_id: userId, day, ...fields });
    if (error) return null; // another tab got there first
  } else {
    // Only if nobody else answered in between: the stored picks must still be what we read.
    const { data } = await db
      .from("trivia_plays")
      .update(fields)
      .eq("user_id", userId)
      .eq("day", day)
      .filter("picks", "eq", `{${picks.join(",")}}`)
      .select("day");
    if (!data?.length) return null;
  }
  if (!last) return { picks: next, finished: null };

  const streak = await triviaStreakFor(userId, day);
  const pts = triviaPoints(correct, streak);
  await awardPoints(userId, "trivia", pts.answers, day);
  await awardPoints(userId, "trivia", pts.bonus, `${day}:streak`);
  return { picks: next, finished: { correct, streak, ...pts } };
}

/** Admin view: every question from `from` for `n` days, grouped by day. */
export async function triviaSchedule(from: string, n: number) {
  const { data } = await admin()
    .from("trivia_questions")
    .select("id, day, position, question, choices, answer, why, status")
    .gte("day", from)
    .lt("day", addDays(from, n))
    .order("day")
    .order("position");
  const byDay = new Map<string, NonNullable<typeof data>>();
  for (let i = 0; i < n; i++) byDay.set(addDays(from, i), []);
  for (const q of data ?? []) byDay.get(q.day)?.push(q);
  return [...byDay.entries()].map(([day, questions]) => ({
    day,
    questions,
    approved: questions.length === TRIVIA_PER_DAY && questions.every((q) => q.status === "approved"),
  }));
}
