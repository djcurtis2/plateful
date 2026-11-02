"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { makeVersion } from "@/app/actions";
import { ALLERGY_NOTE, VERSIONS, VERSION_IDS, type VersionKind } from "@/lib/diet";

type Existing = { kind: string; slug: string; dish: string };

/** "Make it my way": pick vegetarian, gluten-free, lighter, air fryer, ... Existing versions open instantly. */
export function VersionMaker({
  recipeId,
  signedIn,
  plus,
  triesLeft,
  existing,
  suggest,
  already,
  next,
}: {
  recipeId: string;
  signedIn: boolean;
  plus: boolean;
  triesLeft: number;
  existing: Existing[];
  suggest: string[]; // version kinds that would fix the cook's diets
  already: string[]; // diet versions this recipe already meets
  next: string;
}) {
  const [busy, setBusy] = useState<VersionKind | null>(null);
  const [error, setError] = useState("");
  const [, start] = useTransition();
  const router = useRouter();
  const made = new Map(existing.map((e) => [e.kind, e]));
  const kinds = VERSION_IDS.filter((k) => !(VERSIONS[k].diet && already.includes(VERSIONS[k].diet!)));
  const order = [...kinds.filter((k) => suggest.includes(k)), ...kinds.filter((k) => !suggest.includes(k))];
  const locked = signedIn && !plus && triesLeft <= 0;

  return (
    <section className="card flex flex-col gap-4 p-5" aria-labelledby="my-way">
      <div>
        <span className="label">Make it my way</span>
        <h2 id="my-way" className="font-display text-2xl font-bold">
          Want a different version?
        </h2>
        <p className="text-sm text-muted">
          Plateful rewrites the recipe with real swaps and keeps it close to the original. Versions other cooks already made open instantly.
          {signedIn && !plus && triesLeft > 0 ? " Try one free; it's part of Plateful Plus." : ""}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {order.map((k) => {
          const e = made.get(k);
          const hot = suggest.includes(k);
          const cls = `rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
            e ? "border-basil bg-basil/15 text-basil hover:bg-basil hover:text-basil-ink" : hot ? "border-saffron bg-saffron/15 hover:bg-saffron hover:text-saffron-ink" : "border-line bg-surface hover:border-basil"
          }`;
          if (e)
            return (
              <Link key={k} href={`/r/${e.slug}`} className={cls}>
                {VERSIONS[k].label} ✓
              </Link>
            );
          return (
            <button
              key={k}
              className={cls}
              disabled={!!busy || (signedIn && locked)}
              onClick={() => {
                if (!signedIn) return router.push(`/login?next=${encodeURIComponent(next)}`);
                setBusy(k);
                setError("");
                start(async () => {
                  const r = await makeVersion(recipeId, k);
                  setBusy(null);
                  if (r.ok) router.push(`/r/${r.slug}`);
                  else setError(r.message);
                });
              }}
            >
              {busy === k ? `Making ${VERSIONS[k].label.toLowerCase()}…` : VERSIONS[k].label}
            </button>
          );
        })}
      </div>
      {busy && <p className="text-sm text-muted">Rewriting the recipe. This takes about 15 seconds.</p>}
      {error && (
        <p role="alert" className="text-sm text-chili">
          {error}
        </p>
      )}
      {locked && (
        <p className="flex flex-wrap items-center gap-3 text-sm">
          You&apos;ve used your free try. Versions others already made (marked ✓) are still free to open.
          <Link href="/pricing" className="btn btn-sun btn-sm">
            Get Plus
          </Link>
        </p>
      )}
      {!signedIn && <p className="text-sm text-muted">Sign in to make a version.</p>}
      <p className="text-xs text-muted">{ALLERGY_NOTE}</p>
    </section>
  );
}
