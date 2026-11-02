"use client";
import { celebrate, earnedText, here } from "@/lib/celebrate";
import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { postAttempt } from "@/app/actions";
import { ShareCard } from "@/components/ShareCard";
import { POINTS } from "@/lib/game";
import type { Recipe } from "@/lib/recipe";
import type { Attempt } from "@/lib/data";

type Existing = Pick<Attempt, "id" | "caption" | "cost_per_plate" | "cost_source" | "minutes" | "swaps" | "notes">;

const fileTypes = "image/jpeg,image/png,image/webp";

/**
 * Post your cook-off entry, or edit it. One entry per person per dish:
 * a new photo replaces the old one (and resets its votes); without a photo only the details change.
 */
export function AttemptForm({
  recipe,
  challengeId,
  signedIn,
  existing = null,
  next,
  shareUrl,
}: {
  recipe: Recipe;
  challengeId?: string;
  signedIn: boolean;
  existing?: Existing | null;
  next: string;
  shareUrl: string;
}) {
  const form = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(!existing);
  const [preview, setPreview] = useState<string | null>(null);
  const [receiptName, setReceiptName] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [done, setDone] = useState<{ id: string; receipt: { verified: boolean; message: string } | null } | null>(null);
  const router = useRouter();
  const [pending, start] = useTransition();
  const verified = existing?.cost_source === "receipt";

  if (!signedIn) {
    return (
      <p className="rounded-2xl bg-sunk px-4 py-3 text-sm">
        Made it?{" "}
        <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-semibold text-basil underline">
          Sign in
        </Link>{" "}
        to post your version.
      </p>
    );
  }

  if (done && preview) {
    return (
      <div className="card flex flex-col gap-4 p-4 sm:p-5">
        <div>
          <p className="font-display text-xl font-bold">You&apos;re in! Now rally your votes</p>
          <p className="text-sm text-muted">
            Your link opens your entry next to the original with a big Vote button. Every vote earns you points.
          </p>
          {done.receipt && <p className={`mt-2 text-sm ${done.receipt.verified ? "text-basil" : "text-chili"}`}>{done.receipt.message}</p>}
        </div>
        <div className="mx-auto w-full max-w-sm">
          <ShareCard
            recipe={recipe}
            shareUrl={challengeId ? shareUrl.replace(/\/r\/[^?]+/, `/cookoff/e/${done.id}`) : shareUrl}
            initialAttempt={preview}
            cta={challengeId ? "Vote for me" : "Cook it"}
          />
        </div>
      </div>
    );
  }

  if (!open) {
    return (
      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm">
          <b>Your entry is in.</b> Add your price, time or how you made it, so voters can see what you did.
          {note && <span className="mt-1 block text-basil">{note}</span>}
        </p>
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
          Edit my entry
        </button>
      </div>
    );
  }

  return (
    <form
      ref={form}
      className="card flex flex-col gap-4 p-4 sm:p-5"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const file = fd.get("image");
        const hasPhoto = file instanceof File && file.size > 0;
        if (!hasPhoto && !existing) {
          setError("Add a photo of your version first.");
          return;
        }
        const receipt = fd.get("receipt");
        if (!(receipt instanceof File) || receipt.size === 0) fd.delete("receipt");
        if (!hasPhoto) fd.delete("image");
        fd.set("recipeId", recipe.id);
        if (challengeId) fd.set("challengeId", challengeId);
        const at = here();
        start(async () => {
          const r = await postAttempt(fd);
          if (!r.ok) return setError(r.message);
          if (r.points || r.saved) celebrate({ text: earnedText(r.points, r.saved), origin: at, big: !existing });
          setError("");
          router.refresh(); // update the board, your rank and points
          if (hasPhoto) {
            setDone({ id: r.attemptId, receipt: r.receipt });
          } else {
            setNote(r.receipt ? r.receipt.message : "Saved.");
            setOpen(false);
          }
          setReceiptName("");
        });
      }}
    >
      <div className="flex flex-col gap-4 sm:flex-row">
        <label
          htmlFor="attempt-file"
          className={`group flex shrink-0 cursor-pointer flex-col items-center gap-1.5 self-start rounded-2xl border-[1.5px] border-dashed p-2 transition-colors hover:border-basil hover:bg-sunk ${error && !preview && !existing ? "border-chili" : "border-basil/60"}`}
        >
          <span className="grid size-24 place-items-center overflow-hidden rounded-xl bg-basil text-basil-ink">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Your photo" className="size-full object-cover" />
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                <rect x="3" y="6" width="18" height="14" rx="3" />
                <circle cx="12" cy="13" r="3.5" />
                <path d="M9 6l1.5-2h3L15 6" />
              </svg>
            )}
          </span>
          <span className="text-xs font-semibold text-basil group-hover:underline">{preview ? "Change photo" : existing ? "New photo" : "Add photo"}</span>
          <input
            id="attempt-file"
            name="image"
            type="file"
            accept={fileTypes}
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              setError("");
              setPreview(f ? URL.createObjectURL(f) : null);
            }}
          />
        </label>

        <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="label">Caption</span>
            <input name="caption" maxLength={200} className="input" defaultValue={existing?.caption ?? ""} placeholder="Swapped in brown rice, still slaps" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="label">Cost per plate</span>
            <span className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">$</span>
              <input
                name="cost"
                type="number"
                inputMode="decimal"
                min={0}
                max={200}
                step="0.01"
                className="input w-full pl-7"
                defaultValue={existing?.cost_per_plate ?? ""}
                placeholder={recipe.plate_cost ? recipe.plate_cost.toFixed(2) : "3.50"}
              />
            </span>
            {verified && <span className="text-xs text-basil">✓ Verified from your receipt. Typing a new price replaces it.</span>}
          </label>
          <label className="flex flex-col gap-1">
            <span className="label">Time, start to plate</span>
            <span className="relative">
              <input name="minutes" type="number" inputMode="numeric" min={1} max={1440} className="input w-full pr-12" defaultValue={existing?.minutes ?? ""} placeholder={String(recipe.minutes ?? 30)} />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">min</span>
            </span>
          </label>
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="label">Swaps</span>
            <input name="swaps" maxLength={200} className="input" defaultValue={existing?.swaps ?? ""} placeholder="Brown rice for white, no sour cream" />
          </label>
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="label">How I made it</span>
            <textarea
              name="notes"
              maxLength={1000}
              rows={3}
              className="input min-h-20"
              defaultValue={existing?.notes ?? ""}
              placeholder="Your tricks: what you changed, what you'd do differently. Shown on your entry page."
            />
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-2xl bg-sunk p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm">
          <p className="font-semibold">Get a ✓ verified price (+{POINTS.receipt} points)</p>
          <p className="text-xs text-muted">
            Add a photo of your grocery receipt. We read the prices, work out your cost per plate, then throw the receipt away. Only verified prices can win Thriftiest copy.
          </p>
        </div>
        <label className="btn btn-ghost btn-sm shrink-0 cursor-pointer">
          {receiptName ? "Receipt added ✓" : "Add receipt"}
          <input name="receipt" type="file" accept={fileTypes} className="sr-only" onChange={(e) => setReceiptName(e.target.files?.[0]?.name ?? "")} />
        </label>
      </div>

      {existing && !error && preview && <p className="text-xs text-muted">A new photo replaces your current one and resets its votes.</p>}
      {error && (
        <p role="alert" className="text-sm text-chili">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn btn-primary" disabled={pending}>
          {pending ? (receiptName ? "Reading receipt…" : "Saving…") : !existing ? "Post my version" : preview ? "Replace my version" : "Save details"}
        </button>
        {existing && (
          <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
