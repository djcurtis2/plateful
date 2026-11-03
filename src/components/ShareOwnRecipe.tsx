"use client";
import { useState, useTransition } from "react";
import { shareOwnRecipe, stopSharingOwnRecipe } from "@/app/actions";

/** Share one of your own recipes by private link: only people you send it to can open it. */
export function ShareOwnRecipe({ recipeId, dish, initialUrl }: { recipeId: string; dish: string; initialUrl: string | null }) {
  const [url, setUrl] = useState(initialUrl);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();

  async function send(link: string) {
    try {
      if (navigator.share) await navigator.share({ title: dish, text: `My recipe for ${dish}`, url: link });
      else {
        await navigator.clipboard.writeText(link);
        setMsg("Link copied");
      }
    } catch {
      // Closed the share sheet: nothing to do.
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setMsg("");
              if (url) return send(url);
              const r = await shareOwnRecipe(recipeId);
              if (!r.ok) return setMsg(r.message);
              setUrl(r.url);
              await send(r.url);
            })
          }
        >
          {pending ? "Making a link…" : "Share by link"}
        </button>
        {url && (
          <button
            type="button"
            className="text-xs text-muted underline"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await stopSharingOwnRecipe(recipeId);
                if (r.ok) setUrl(null);
                setMsg(r.message ?? "");
              })
            }
          >
            Turn off link
          </button>
        )}
      </span>
      {url && (
        <input
          readOnly
          value={url}
          aria-label="Share link"
          onFocus={(e) => e.currentTarget.select()}
          className="input w-full font-mono text-xs"
        />
      )}
      <p className="text-xs text-muted" role="status">
        {msg || (url ? "Anyone with this link can see the recipe and save a copy. It isn't listed anywhere." : "")}
      </p>
    </div>
  );
}
