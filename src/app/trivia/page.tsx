import type { Metadata } from "next";
import Link from "next/link";
import { getMe } from "@/lib/data";
import { triviaPlay, triviaQuestions, triviaStreakFor } from "@/lib/trivia-server";
import { TRIVIA_PER_DAY, TRIVIA_STREAK_BONUS, TRIVIA_STREAK_EVERY, triviaDay, triviaPoints } from "@/lib/trivia";
import { POINTS } from "@/lib/game";
import { contactEmail, siteUrl } from "@/lib/env";
import { TriviaGame } from "@/components/TriviaGame";

export const metadata: Metadata = {
  title: "Daily trivia",
  description: "Three quick cooking questions a day. Learn a kitchen trick, keep your streak, earn points.",
};
export const dynamic = "force-dynamic";

export default async function TriviaPage() {
  const day = triviaDay();
  const [questions, me] = await Promise.all([triviaQuestions(day), getMe()]);
  const ready = questions.length === TRIVIA_PER_DAY;
  const [play, streak] = me && ready ? await Promise.all([triviaPlay(me.user.id, day), triviaStreakFor(me.user.id, day)]) : [null, 0];

  // Only answered questions travel with their answers; the rest go without.
  const picks = play?.picks ?? [];
  const finished = play?.finished_at ? { correct: play.correct, streak, ...triviaPoints(play.correct, streak) } : null;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 pt-8">
      <div>
        <span className="label">Daily trivia</span>
        <h1 className="font-display text-4xl font-bold tracking-tight">Three questions, one kitchen trick each</h1>
        <p className="text-muted">
          New questions every day, the same for everyone. {POINTS.trivia} point per right answer, plus {TRIVIA_STREAK_BONUS} more every{" "}
          {TRIVIA_STREAK_EVERY} days in a row.
        </p>
      </div>

      {ready ? (
        <TriviaGame
          day={day}
          signedIn={!!me}
          streak={streak}
          shareUrl={`${siteUrl}/trivia`}
          questions={questions.map((q, i) => ({
            position: q.position,
            question: q.question,
            choices: q.choices,
            result: i < picks.length ? { pick: picks[i], answer: q.answer, why: q.why } : null,
          }))}
          finished={finished}
        />
      ) : (
        <p className="card p-6 text-muted">
          Today&apos;s questions are still in the oven. Check back later, or <Link href="/cookoff" className="font-semibold text-basil underline">vote in the cook-off</Link> meanwhile.
        </p>
      )}

      <p className="text-xs text-muted">
        Questions are written with AI and checked by the Yumjack team.
        {contactEmail && (
          <>
            {" "}Spot a wrong answer? Email <a href={`mailto:${contactEmail}`} className="underline">{contactEmail}</a>.
          </>
        )}{" "}
        Trivia points count toward your level and gear, not the monthly cook-off prize. <Link href="/rules" className="underline">Rules</Link>
      </p>
    </main>
  );
}
