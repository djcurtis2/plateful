"use client";
import { DishArt } from "@/components/DishArt";
import Link from "next/link";
import { useState, useTransition } from "react";
import { submitHlGuess } from "@/app/games/actions";
import { celebrate, here } from "@/lib/celebrate";
import { HL_POINTS_EVERY, hlPoints, hlShareText, type HlGuess } from "@/lib/games";
import type { HlCard } from "@/lib/games-server";
import { money } from "@/lib/format";
import { ShareButton } from "@/components/ShareButton";

type Shown = HlCard & { price: number };

function Card({ card, price, tone }: { card: HlCard; price: number | null; tone: "known" | "mystery" | "right" | "wrong" }) {
  const ring = tone === "right" ? "ring-4 ring-basil" : tone === "wrong" ? "ring-4 ring-chili" : "";
  return (
    <div className={`card flex flex-col overflow-hidden transition-shadow ${ring}`}>
      <div className="relative aspect-[4/3] bg-sunk">
        {card.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.image_url} alt="" className="size-full object-cover" />
        ) : (
          <DishArt dish={card.dish} seed={card.slug} />
        )}
      </div>
      <div className="flex flex-col gap-1 p-4">
        {card.restaurant && <span className="label truncate">{card.restaurant}</span>}
        <span className="font-display text-lg font-bold leading-tight">{card.dish}</span>
        <span className="tabular font-mono text-2xl font-semibold">
          {price != null ? (
            <>
              {money(price)} <span className="text-sm font-normal text-muted">a plate</span>
            </>
          ) : (
            <span className="text-muted">$ ?</span>
          )}
        </span>
      </div>
    </div>
  );
}

/**
 * Higher or Lower: is the next restaurant dish more or less per plate than this one? Keep going until you miss.
 * The next price stays on the server until you guess.
 */
export function HigherLowerGame({
  day,
  signedIn,
  initial,
  shareUrl,
}: {
  day: string;
  signedIn: boolean;
  initial: { current: Shown | null; next: HlCard | null; score: number; over: boolean; perfect: boolean };
  shareUrl: string;
}) {
  const [current, setCurrent] = useState<Shown | null>(initial.current);
  const [next, setNext] = useState<HlCard | null>(initial.next);
  const [revealed, setRevealed] = useState<{ price: number; right: boolean } | null>(null);
  const [score, setScore] = useState(initial.score);
  const [over, setOver] = useState(initial.over);
  const [perfect, setPerfect] = useState(initial.perfect);
  const [guesses, setGuesses] = useState<HlGuess[]>([]); // guests only: replayed by the server
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function guess(g: HlGuess) {
    if (!next || !current) return;
    setError(null);
    const at = here();
    start(async () => {
      const r = await submitHlGuess(day, g, signedIn ? [] : guesses);
      if ("error" in r) return setError(r.error ?? "Something went wrong. Reload and try again.");
      if (!signedIn) setGuesses((p) => [...p, g]);
      setRevealed({ price: r.revealedPrice, right: r.right });
      setScore(r.state.score);
      // Let the price land before moving on.
      await new Promise((ok) => setTimeout(ok, 1100));
      setRevealed(null);
      if (r.right && !r.state.over) {
        setCurrent({ ...next, price: r.revealedPrice });
        setNext(r.next);
        if (r.state.score % HL_POINTS_EVERY === 0) celebrate({ text: `${r.state.score} in a row!`, origin: at });
      } else {
        if (r.right) setCurrent({ ...next, price: r.revealedPrice });
        setNext(null);
        setOver(true);
        setPerfect(r.state.perfect);
        const pts = r.state.points;
        if (pts > 0 && signedIn) celebrate({ text: `+${pts} points`, origin: at, big: r.state.perfect });
      }
    });
  }

  if (!current) return null;

  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <span className="label">{over ? "Run over" : "Restaurant price per plate"}</span>
        <span className="tabular font-mono text-lg font-semibold" aria-live="polite">
          🔥 {score} in a row
        </span>
      </div>

      {!over && next ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card card={current} price={current.price} tone="known" />
            <Card card={next} price={revealed?.price ?? null} tone={revealed ? (revealed.right ? "right" : "wrong") : "mystery"} />
          </div>
          <div className="flex flex-col items-center gap-2">
            <p className="text-center font-semibold">
              Is <b>{next.dish}</b> more or less per plate than {money(current.price)}?
            </p>
            <div className="flex gap-3">
              <button type="button" className="btn btn-primary min-w-32" disabled={pending} onClick={() => guess("higher")}>
                ▲ Higher
              </button>
              <button type="button" className="btn btn-sun min-w-32" disabled={pending} onClick={() => guess("lower")}>
                ▼ Lower
              </button>
            </div>
            <p className="text-xs text-muted">Same price counts as right. Shareable orders are split per plate.</p>
          </div>
        </>
      ) : (
        <div className="card flex flex-col gap-4 p-6" aria-live="polite">
          <div>
            <span className="label">Today&apos;s run</span>
            <p className="font-display text-5xl font-bold">{perfect ? "Perfect!" : `${score} in a row`}</p>
          </div>
          {signedIn ? (
            <p>
              {hlPoints(score) > 0 ? <b>+{hlPoints(score)} points.</b> : `Get ${HL_POINTS_EVERY} in a row for a point.`} A new deck tomorrow.
            </p>
          ) : (
            <p>
              <Link href="/login?next=/games/higher-lower" className="font-semibold text-basil underline">
                Sign in
              </Link>{" "}
              to earn points and get on the daily leaderboard.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <ShareButton text={hlShareText(day, score, perfect, shareUrl)} />
            <Link href="/games" className="btn btn-ghost">
              More games
            </Link>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-chili">
          {error}
        </p>
      )}
    </section>
  );
}
