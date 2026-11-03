"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { celebrate } from "@/lib/celebrate";
import { ChefAvatar } from "@/components/ChefAvatar";
import { saveChef, markGearSeen } from "@/app/chef/actions";
import type { Avatar, GearItem } from "@/lib/avatar";

// Once one celebration has closed, no other mounts until a real page load (module state resets on reload).
let shownThisLoad = false;

/** One-time "you unlocked something" moment: your chef wearing the first new item, Equip it or Later. Closing marks every listed item seen. */
export function GearUnlock({ items, avatar, uid }: { items: GearItem[]; avatar: Avatar; uid: string }) {
  const item = items[0];
  const more = items.length - 1;
  const router = useRouter();
  const [open, setOpen] = useState(() => !shownThisLoad);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const equipRef = useRef<HTMLButtonElement>(null);

  const wearing: Avatar = { ...avatar, equipped: { ...avatar.equipped, [item.slot]: item.id } };

  useEffect(() => {
    if (shownThisLoad) return;
    equipRef.current?.focus();
    celebrate({ big: true, origin: { x: window.innerWidth / 2, y: window.innerHeight * 0.4 } });
  }, []);

  async function close() {
    setBusy(true);
    try {
      await markGearSeen(items.map((i) => i.id));
    } catch {
      // Not marking it seen just means it shows again next load.
    }
    shownThisLoad = true;
    setOpen(false);
    router.refresh();
  }

  async function equip() {
    setBusy(true);
    setError(null);
    try {
      const res = await saveChef(wearing);
      if (!res.ok) {
        setError(res.message);
        setBusy(false);
        return;
      }
    } catch {
      setError("Couldn't save. Try again.");
      setBusy(false);
      return;
    }
    await close();
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) void close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, busy]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="gear-unlock-title"
        className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 text-center shadow-xl"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          {more ? `${items.length} new gear items unlocked` : "New gear unlocked"}
        </p>
        <div className="mx-auto mt-3 flex justify-center">
          <ChefAvatar avatar={wearing} size={160} uid={`gear-unlock-${uid}`} title={`Your chef wearing ${item.name}`} />
        </div>
        <h2 id="gear-unlock-title" className="font-display mt-3 text-2xl font-bold">
          {item.name}
        </h2>
        <p className="text-sm capitalize text-muted">
          {item.rarity} {item.slot}
        </p>
        {more > 0 && (
          <p className="mt-2 text-sm">
            Plus {more} more:{" "}
            <Link href="/chef?tab=wardrobe" className="font-semibold text-basil underline" onClick={() => void close()}>
              see them in your Wardrobe
            </Link>
          </p>
        )}
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="mt-5 flex justify-center gap-2">
          <button ref={equipRef} type="button" className="btn btn-primary" disabled={busy} onClick={equip}>
            Equip it
          </button>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={close}>
            Later
          </button>
        </div>
      </div>
    </div>
  );
}
