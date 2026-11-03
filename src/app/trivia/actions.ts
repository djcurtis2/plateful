"use server";
import { revalidatePath } from "next/cache";
import { getMe } from "@/lib/data";
import { recordTriviaPick, triviaQuestions } from "@/lib/trivia-server";
import { TRIVIA_PER_DAY, triviaDay } from "@/lib/trivia";

type Answer =
  | {
      ok: true;
      pick: number;
      answer: number;
      why: string;
      finished: { correct: number; streak: number; answers: number; bonus: number; total: number } | null;
    }
  | { ok: false; message: string };

/**
 * Checks one trivia answer. Answers stay on the server until a pick is made.
 * Signed-in players get one go per day, saved in order; guests can play but earn no points.
 */
export async function answerTrivia(day: string, position: number, choice: number): Promise<Answer> {
  if (day !== triviaDay()) return { ok: false, message: "A new day's trivia just started. Reload to play it." };
  if (!Number.isInteger(position) || position < 1 || position > TRIVIA_PER_DAY) return { ok: false, message: "Unknown question." };
  if (!Number.isInteger(choice) || choice < 0 || choice > 3) return { ok: false, message: "Pick one of the answers." };
  const questions = await triviaQuestions(day);
  if (questions.length < TRIVIA_PER_DAY) return { ok: false, message: "Today's trivia isn't ready yet." };
  const q = questions[position - 1];

  const me = await getMe();
  if (!me) return { ok: true, pick: choice, answer: q.answer, why: q.why, finished: null };

  const saved = await recordTriviaPick(me.user.id, day, position, choice, questions);
  if (!saved) return { ok: false, message: "That answer didn't save. Reload the page and carry on." };
  if (saved.finished) revalidatePath("/", "layout"); // header points
  return { ok: true, pick: saved.picks[position - 1], answer: q.answer, why: q.why, finished: saved.finished };
}
