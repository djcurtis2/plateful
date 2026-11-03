"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { answerTrivia } from "@/app/trivia/actions";
import { celebrate, here } from "@/lib/celebrate";
import { TRIVIA_STREAK_EVERY, triviaShareText } from "@/lib/trivia";

type Result = { pick: number; answer: number; why: string };
type Finished = { correct: number; streak: number; answers: number; bonus: number; total: number };

/** One question at a time: pick, see the answer and why, then the next. Ends with a spoiler-free result to share. */
export function TriviaGame({
  day,
  signedIn,
  streak,
  shareUrl,
  questions,
  finished: initialFinished,
}: {
  day: string;
  signedIn: boolean;
  streak: number;
  shareUrl: string;
  questions: { position: number; question: string; choices: string[]; result: Result | null }[];
  finished: Finished | null;
}) {
  const [results, setResults] = useState<(Result | null)[]>(questions.map((q) => q.result));
  const [finished, setFinished] = useState<Finished | null>(initialFinished);
  const firstOpen = results.findIndex((r) => !r);
  const [view, setView] = useState(firstOpen < 0 ? questions.length : firstOpen);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const done = results.every(Boolean);
  const rights = results.map((r) => !!r && r.pick === r.answer);

  function pick(choice: number) {
    const q = questions[view];
    setError(null);
    const at = here();
    start(async () => {
      const r = await answerTrivia(day, q.position, choice);
      if (!r.ok) return setError(r.message);
      setResults((prev) => prev.map((x, i) => (i === view ? { pick: r.pick, answer: r.answer, why: r.why } : x)));
      if (r.finished) {
        setFinished(r.finished);
        if (r.finished.total > 0) celebrate({ text: `+${r.finished.total} points`, origin: at });
      }
    });
  }

  async function share() {
    const text = triviaShareText(day, rights, shareUrl);
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        setCopied(true);
      }
    } catch {
      // Closed the share sheet: nothing to do.
    }
  }

  if (view >= questions.length) {
    const right = rights.filter(Boolean).length;
    return (
      <section className="card flex flex-col gap-5 p-6" aria-live="polite">
        <div>
          <span className="label">Today&apos;s score</span>
          <p className="font-display text-5xl font-bold">
            {right}/{questions.length}
          </p>
          <p className="mt-1 text-2xl" aria-hidden>
            {rights.map((r) => (r ? "🟩" : "🟥")).join("")}
          </p>
        </div>
        {signedIn && finished ? (
          <p>
            {finished.total > 0 ? (
              <>
                <b>+{finished.total} points</b>
                {finished.bonus > 0 && <> (including a {finished.bonus}-point bonus for {finished.streak} days in a row)</>}.
              </>
            ) : (
              <>No points today, but every answer teaches you something.</>
            )}{" "}
            {finished.streak > 1 ? `You're on a ${finished.streak}-day streak.` : "Come back tomorrow to start a streak."}{" "}
            {finished.streak % TRIVIA_STREAK_EVERY !== 0 &&
              `${TRIVIA_STREAK_EVERY - (finished.streak % TRIVIA_STREAK_EVERY)} more ${TRIVIA_STREAK_EVERY - (finished.streak % TRIVIA_STREAK_EVERY) === 1 ? "day" : "days"} to the next bonus.`}
          </p>
        ) : (
          <p>
            <Link href="/login?next=/trivia" className="font-semibold text-basil underline">
              Sign in
            </Link>{" "}
            to earn points and keep a daily streak. It&apos;s free.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" onClick={share}>
            {copied ? "Copied!" : "Share my score"}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setView(0)}>
            Review answers
          </button>
        </div>
        <p className="text-sm text-muted">New questions tomorrow.</p>
      </section>
    );
  }

  const q = questions[view];
  const res = results[view];
  return (
    <section className="card flex flex-col gap-5 p-6">
      <div className="flex items-center justify-between gap-3">
        <span className="label">
          Question {view + 1} of {questions.length}
        </span>
        <span className="flex gap-1" aria-hidden>
          {questions.map((_, i) => (
            <span
              key={i}
              className={`size-2.5 rounded-full ${results[i] ? (rights[i] ? "bg-basil" : "bg-chili") : i === view ? "bg-ink" : "bg-line"}`}
            />
          ))}
        </span>
      </div>
      <h2 className="font-display text-2xl font-bold leading-snug">{q.question}</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {q.choices.map((c, i) => {
          const state = !res ? "open" : i === res.answer ? "right" : i === res.pick ? "wrong" : "other";
          return (
            <button
              key={i}
              type="button"
              disabled={!!res || pending}
              onClick={() => pick(i)}
              aria-pressed={res ? i === res.pick : undefined}
              className={`rounded-xl border-2 px-4 py-3 text-left font-medium transition ${
                state === "open"
                  ? "border-line bg-surface hover:border-basil disabled:opacity-60"
                  : state === "right"
                    ? "border-basil bg-basil/10"
                    : state === "wrong"
                      ? "border-chili bg-chili/10"
                      : "border-line opacity-60"
              }`}
            >
              {c}
              {state === "right" && <span className="sr-only"> (right answer)</span>}
              {state === "wrong" && <span className="sr-only"> (your pick)</span>}
            </button>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="text-sm text-chili">
          {error}
        </p>
      )}
      {res && (
        <div className="flex flex-col gap-3" aria-live="polite">
          <p>
            <b className={res.pick === res.answer ? "text-basil" : "text-chili"}>{res.pick === res.answer ? "Right!" : "Not quite."}</b> {res.why}
          </p>
          <button type="button" className="btn btn-primary self-start" onClick={() => setView(view + 1)}>
            {view + 1 < questions.length ? "Next question" : done ? "See my score" : "Next"}
          </button>
        </div>
      )}
    </section>
  );
}
