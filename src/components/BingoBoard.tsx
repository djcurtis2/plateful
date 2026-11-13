"use client";
// The weekly Bingo card. Tap a square to see what ticks it, how far along you are, and a button to go do it.
// A new line since your last visit gets confetti and a share prompt (remembered per browser, per week).
import { useEffect, useState } from "react";
import Link from "next/link";
import { celebrate } from "@/lib/celebrate";
import { ShareButton } from "@/components/ShareButton";

export type BingoCell = {
  label: string;
  how: string;
  href: string;
  free: boolean;
  done: boolean;
  inLine: boolean;
  progress: string | null;
};

type Props = {
  week: string;
  cells: BingoCell[];
  signedIn: boolean;
  lines: number;
  full: boolean;
  earned: number;
  shareText: string;
  pointsPerLine: number;
  fullPoints: number;
};

const SEEN_KEY = (week: string) => `yj-bingo-seen:${week}`;

export function BingoBoard({ week, cells, signedIn, lines, full, earned, shareText, pointsPerLine, fullPoints }: Props) {
  // Start on the first open square, so a tap isn't needed to learn what to do next.
  const firstOpen = cells.findIndex((c) => !c.done && !c.free);
  const [pick, setPick] = useState<number>(firstOpen);
  const [fresh, setFresh] = useState<null | "line" | "full">(null);

  useEffect(() => {
    if (!signedIn) return;
    const now = lines + (full ? 100 : 0);
    let seen = 0;
    try {
      seen = Number(localStorage.getItem(SEEN_KEY(week)) ?? 0) || 0;
      localStorage.setItem(SEEN_KEY(week), String(now));
    } catch {
      return; // no storage: skip the party rather than repeat it every visit
    }
    if (now <= seen) return;
    const kind = full && seen < 100 ? "full" : "line";
    setFresh(kind);
    const t = setTimeout(
      () => celebrate({ big: kind === "full", text: kind === "full" ? `Full card! +${fullPoints}` : `Bingo! +${pointsPerLine}` }),
      250,
    );
    return () => clearTimeout(t);
  }, [signedIn, lines, full, week, pointsPerLine, fullPoints]);

  const sel = pick >= 0 ? cells[pick] : null;

  return (
    <div className="flex flex-col gap-4">
      {fresh && (
        <div role="status" className="flex flex-col gap-3 rounded-2xl bg-saffron p-4 text-saffron-ink sm:flex-row sm:items-center sm:justify-between">
          <p>
            <b className="font-display text-2xl">{fresh === "full" ? "Full card!" : "Bingo!"}</b>{" "}
            {fresh === "full" ? "Every square this week. Show it off." : "You finished a line. Show your card."}
          </p>
          <ShareButton text={shareText} label="Share my card" className="btn bg-ink text-bg hover:opacity-90" />
        </div>
      )}

      <ol className="grid grid-cols-3 gap-2 sm:gap-3">
        {cells.map((c, i) => {
          const tone = c.free
            ? "bg-saffron text-saffron-ink"
            : c.done
              ? `bg-basil text-basil-ink ${c.inLine ? "ring-4 ring-saffron" : ""}`
              : "bg-sunk text-ink hover:ring-2 hover:ring-basil";
          const picked = pick === i;
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => setPick(picked ? -1 : i)}
                aria-pressed={picked}
                aria-label={c.free ? "Free square" : `${c.label}${c.done ? ", done" : c.progress ? `, ${c.progress}` : ""}`}
                className={`relative flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-2xl p-2 text-center transition-shadow ${tone} ${picked ? "outline outline-3 outline-offset-2 outline-ink" : ""}`}
              >
                <span className="text-lg" aria-hidden>
                  {c.free ? "⭐" : c.done ? "✓" : ""}
                </span>
                <span className="text-xs font-semibold leading-tight sm:text-sm">{c.free ? "Free" : c.label}</span>
                {!c.done && c.progress && <span className="tabular text-[10px] font-semibold text-muted sm:text-xs">{c.progress}</span>}
              </button>
            </li>
          );
        })}
      </ol>

      {sel && (
        <div className="flex flex-col gap-2 rounded-2xl border border-line p-4" aria-live="polite">
          <p className="flex flex-wrap items-baseline gap-2">
            <b>{sel.free ? "Free square" : sel.label}</b>
            {!sel.free && (
              <span className={`text-sm ${sel.done ? "font-semibold text-basil" : "text-muted"}`}>
                {sel.done ? "Done ✓" : sel.progress ?? "Not yet"}
              </span>
            )}
          </p>
          <p className="text-sm text-muted">{sel.free ? "Everyone gets the middle square." : sel.how}</p>
          {!sel.free && !sel.done && (
            <Link href={signedIn ? sel.href : "/login?next=/games/bingo"} className="btn btn-primary btn-sm w-fit">
              {signedIn ? "Go do it" : "Sign in to play"}
            </Link>
          )}
        </div>
      )}

      {signedIn ? (
        <div className="flex flex-col gap-3">
          <p>
            {full ? (
              <b>Full card! </b>
            ) : (
              <>
                <b>
                  {lines} {lines === 1 ? "line" : "lines"}
                </b>{" "}
                so far.{" "}
              </>
            )}
            {earned > 0 ? `+${earned} points this week.` : "Finish a row, column or diagonal for points."}
          </p>
          {!fresh && (
            <div className="flex flex-wrap gap-2">
              <ShareButton text={shareText} label="Share my card" />
              <Link href="/games" className="btn btn-ghost">
                More games
              </Link>
            </div>
          )}
        </div>
      ) : (
        <p>
          <Link href="/login?next=/games/bingo" className="font-semibold text-basil underline">
            Sign in
          </Link>{" "}
          to get your own card. Squares tick themselves as you cook, so there&apos;s nothing to fill in.
        </p>
      )}
    </div>
  );
}
