"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { BadgeId } from "@/lib/database.types";
import { BADGES } from "@/lib/game";
import { BadgeIcon, LevelIcon } from "@/components/GameIcons";

type Props = {
  name: string;
  points: number;
  levelIndex: number;
  levelName: string;
  next: string | null;
  toNext: number;
  progress: number;
  badges: BadgeId[];
  newBadges: BadgeId[];
  levelUp: boolean;
  welcome: boolean;
  seenValue: string;
  hasBaseline: boolean;
};

const YEAR = 60 * 60 * 24 * 365;

/**
 * Pops up after sign-in (your level, points and badges) and whenever you earn a badge or level up.
 * Remembers what this browser has already shown in a cookie, so each moment shows once.
 */
export function StatusToast(p: Props) {
  const celebrate = p.levelUp || p.newBadges.length > 0;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Record what's been shown (or set the first baseline), and clear the one-time welcome flag.
    document.cookie = `pf_seen=${p.seenValue}; path=/; max-age=${YEAR}; samesite=lax`;
    if (p.welcome) document.cookie = "pf_welcome=; path=/; max-age=0; samesite=lax";
    if (celebrate || p.welcome) setOpen(true);
  }, [p.seenValue, p.welcome, celebrate]);

  useEffect(() => {
    if (!open || celebrate) return; // celebrations stay until closed
    const t = setTimeout(() => setOpen(false), 9000);
    return () => clearTimeout(t);
  }, [open, celebrate]);

  if (!open) return null;
  const distinct = [...new Set(p.badges)];
  const newDistinct = [...new Set(p.newBadges)];
  const pct = Math.round(p.progress * 100);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-sm animate-[toast-in_.35s_ease-out] sm:inset-x-auto sm:right-6 sm:bottom-6"
    >
      <div className={`card flex flex-col gap-4 p-5 shadow-xl ${celebrate ? "border-saffron" : ""}`}>
        <div className="flex items-start gap-4">
          {newDistinct.length > 0 && !p.levelUp ? (
            <BadgeIcon id={newDistinct[0]} size={56} />
          ) : (
            <LevelIcon index={p.levelIndex} size={56} />
          )}
          <div className="min-w-0 flex-1">
            <p className="label">{p.levelUp ? "Level up!" : newDistinct.length ? (newDistinct.length > 1 ? "New badges!" : "New badge!") : "Welcome back"}</p>
            <p className="font-display text-xl font-bold leading-tight">
              {p.levelUp
                ? `You're now ${p.levelName}`
                : newDistinct.length
                  ? newDistinct.map((b) => BADGES[b].label).join(" + ")
                  : p.name}
            </p>
            <p className="text-sm text-muted">
              {newDistinct.length && !p.levelUp
                ? BADGES[newDistinct[0]].blurb
                : `${p.levelName} · ${p.points} points`}
            </p>
          </div>
          <button aria-label="Close" className="-mr-1 -mt-1 rounded-lg px-2 text-lg text-muted hover:text-ink" onClick={() => setOpen(false)}>
            ×
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <LevelIcon index={p.levelIndex} size={18} /> {p.levelName}
            </span>
            <span className="tabular font-mono">{p.next ? `${p.toNext} to ${p.next}` : "Top level"}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-sunk" role="progressbar" aria-label="Progress to next level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
            <div className="h-full rounded-full bg-basil" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {distinct.length > 0 && (
          <div className="flex items-center gap-1.5">
            {distinct.slice(0, 7).map((b) => (
              <BadgeIcon key={b} id={b} size={26} />
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <Link href="/cookoff" className="btn btn-primary btn-sm" onClick={() => setOpen(false)}>
            This week&apos;s cook-off
          </Link>
          <Link href="/account" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>
            My profile
          </Link>
        </div>
      </div>
    </div>
  );
}
