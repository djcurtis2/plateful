"use client";
import { useState, useTransition } from "react";
import { deleteAccount } from "@/app/account/actions";
import { APPLE_SUBSCRIPTIONS, openExternal } from "@/lib/native";

/** Danger zone: type DELETE, then the account and everything tied to it is removed for good. */
export function DeleteAccount({
  plus,
  stripePlus = false,
  appleUntil = null,
}: {
  plus: boolean;
  /** A live Stripe subscription, which deleting cancels (even when Apple Plus is live too). */
  stripePlus?: boolean;
  appleUntil?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [word, setWord] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // Checked when the form opens (a click), so the server and browser render the same thing.
  const [appleLive, setAppleLive] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        className="btn btn-ghost btn-sm self-start text-chili"
        onClick={() => {
          setAppleLive(!!appleUntil && new Date(appleUntil) > new Date());
          setOpen(true);
        }}
      >
        Delete my account
      </button>
    );
  }
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await deleteAccount(word);
          if (res && !res.ok) setError(res.message);
        });
      }}
    >
      {appleLive && (
        <div role="alert" className="flex flex-col gap-2 rounded-2xl bg-saffron/15 px-4 py-3 text-sm">
          <p className="font-medium">You&apos;re subscribed through Apple. Cancel in iPhone Settings first, or Apple will keep charging you.</p>
          <a
            href={APPLE_SUBSCRIPTIONS}
            className="btn btn-ghost btn-sm self-start"
            onClick={(e) => {
              e.preventDefault();
              void openExternal(APPLE_SUBSCRIPTIONS);
            }}
          >
            Manage in Apple
          </a>
        </div>
      )}
      <p className="text-sm">
        This permanently deletes your account, saved recipes, pantry, plans, cook-off entries and photos, points, badges and gear
        {stripePlus || (plus && !appleLive) ? ", and cancels your Plus subscription" : ""}. Recipes you made stay on Yumjack without your name. This can&apos;t be undone.
      </p>
      <label htmlFor="delete-word" className="label">
        Type DELETE to confirm
      </label>
      <input id="delete-word" className="input" autoComplete="off" value={word} onChange={(e) => setWord(e.target.value)} />
      {error && (
        <p role="alert" className="text-sm text-chili">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" className="btn btn-primary bg-chili" disabled={pending || word.trim().toUpperCase() !== "DELETE"}>
          {pending ? "Deleting…" : "Delete forever"}
        </button>
        <button type="button" className="btn btn-ghost" disabled={pending} onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
