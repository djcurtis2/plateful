"use client";
import { useState, useTransition } from "react";
import { deleteAccount } from "@/app/account/actions";

/** Danger zone: type DELETE, then the account and everything tied to it is removed for good. */
export function DeleteAccount({ plus }: { plus: boolean }) {
  const [open, setOpen] = useState(false);
  const [word, setWord] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button type="button" className="btn btn-ghost btn-sm self-start text-chili" onClick={() => setOpen(true)}>
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
      <p className="text-sm">
        This permanently deletes your account, saved recipes, pantry, plans, cook-off entries and photos, points, badges and gear
        {plus ? ", and cancels your Plus subscription" : ""}. Recipes you made stay on Dupe Kitchen without your name. This can&apos;t be undone.
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
