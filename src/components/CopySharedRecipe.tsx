"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { copySharedRecipe } from "@/app/actions";

/** "Save a copy" on a shared recipe: it becomes your own private recipe to cook and plan with. */
export function CopySharedRecipe({ slug, token, signedIn }: { slug: string; token: string; signedIn: boolean }) {
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  if (!signedIn)
    return (
      <Link href={`/login?next=${encodeURIComponent(`/r/${slug}?k=${token}`)}`} className="btn btn-primary btn-sm shrink-0">
        Sign in to save a copy
      </Link>
    );
  return (
    <span className="flex shrink-0 flex-col items-start gap-1">
      <button
        type="button"
        className="btn btn-primary btn-sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            // On success the action opens your copy; it only returns when something went wrong.
            const r = await copySharedRecipe(slug, token);
            setMsg(r.message);
          })
        }
      >
        {pending ? "Saving…" : "Save a copy to My recipes"}
      </button>
      {msg && (
        <span role="alert" className="text-xs text-chili">
          {msg}
        </span>
      )}
    </span>
  );
}
