"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { makeFromLeftovers } from "@/app/actions";
import { LEFTOVER_STYLES, type LeftoverStyle } from "@/lib/recipe";

/** Pick a style and Claude writes an original recipe around this dish's leftovers. */
export function LeftoverMaker({
  recipeId,
  signedIn,
  next,
  few,
  plus,
  triesLeft,
}: {
  recipeId: string;
  signedIn: boolean;
  next: string;
  few: boolean;
  plus: boolean;
  triesLeft: number;
}) {
  const [style, setStyle] = useState<LeftoverStyle>("weeknight");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <div className="card flex flex-col gap-3 border-dashed p-4 sm:p-5">
      <div>
        <p className="font-display text-lg font-bold">{few ? "Not enough ideas? Make something new" : "Or make something new"}</p>
        <p className="text-sm text-muted">
          Yumjack writes an original recipe around your leftovers, in the style you pick. It&apos;s saved to My recipes.
          {signedIn && !plus && (triesLeft > 0 ? " Try it once free; it's part of Yumjack Plus." : "")}
        </p>
      </div>
      <div role="radiogroup" aria-label="Style" className="flex flex-wrap gap-2">
        {(Object.keys(LEFTOVER_STYLES) as LeftoverStyle[]).map((k) => (
          <button
            key={k}
            role="radio"
            aria-checked={style === k}
            onClick={() => setStyle(k)}
            disabled={pending}
            className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${style === k ? "border-basil bg-basil text-basil-ink" : "border-line bg-surface hover:border-basil"}`}
          >
            {LEFTOVER_STYLES[k].label}
          </button>
        ))}
      </div>
      {signedIn && !plus && triesLeft <= 0 ? (
        <p className="flex flex-wrap items-center gap-3 text-sm">
          You&apos;ve used your free try.
          <Link href="/pricing" className="btn btn-sun btn-sm">
            Get Plus for new recipes every day
          </Link>
        </p>
      ) : signedIn ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            className="btn btn-primary"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setError("");
                const r = await makeFromLeftovers(recipeId, style);
                if (r.ok) router.push(`/r/${r.slug}`);
                else setError(r.message);
              })
            }
          >
            {pending ? "Writing your recipe…" : "Make a recipe"}
          </button>
          {pending && <span className="text-sm text-muted">This takes about 15 seconds.</span>}
          {error && (
            <span role="alert" className="text-sm text-chili">
              {error}
            </span>
          )}
        </div>
      ) : (
        <p className="text-sm">
          <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-semibold text-basil underline">
            Sign in free
          </Link>{" "}
          to make recipes from your leftovers.
        </p>
      )}
    </div>
  );
}
