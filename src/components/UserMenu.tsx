"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEM = "block rounded-lg px-3 py-2 text-sm hover:bg-bg";

/** Signed-in menu behind the chef avatar: every signed-in page plus Sign out, reachable on phones too. */
export function UserMenu({ children, label, nudge, plus }: { children: React.ReactNode; label: string; nudge: boolean; plus: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Close after navigating, on Escape, and on a click anywhere else.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative ml-1">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${label} and account menu`}
        onClick={() => setOpen((o) => !o)}
        className="relative flex rounded-full hover:opacity-80"
      >
        {children}
        {nudge && <span aria-hidden className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-chili ring-2 ring-bg" />}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-30 mt-2 w-52 rounded-2xl border border-line bg-surface p-1.5 shadow-xl">
          <Link role="menuitem" href="/chef" className={`${ITEM} font-semibold`}>
            {label}
          </Link>
          <Link role="menuitem" href="/library" className={ITEM}>My recipes</Link>
          <Link role="menuitem" href="/plan" className={ITEM}>Plan my week</Link>
          <Link role="menuitem" href="/pantry" className={ITEM}>Pantry</Link>
          <Link role="menuitem" href="/leaderboard" className={ITEM}>Leaderboard</Link>
          <Link role="menuitem" href="/clubs" className={ITEM}>Clubs</Link>
          <Link role="menuitem" href="/account" className={ITEM}>{plus ? "Account (Plus)" : "Account"}</Link>
          <div className="my-1 h-px bg-line" />
          <form action="/auth/signout" method="post">
            <button role="menuitem" type="submit" className={`${ITEM} w-full text-left text-muted`}>
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
