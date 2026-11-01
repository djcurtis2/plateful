"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setPublicName } from "@/app/actions";
import { validPublicName } from "@/lib/game";

/** Sets the name shown on your entries and the leaderboard. */
export function NameForm({ initial = "", compact = false }: { initial?: string; compact?: boolean }) {
  const [name, setName] = useState(initial);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <form
      className={`flex flex-col gap-2 ${compact ? "rounded-2xl bg-sunk p-3" : ""}`}
      onSubmit={(e) => {
        e.preventDefault();
        const problem = validPublicName(name);
        if (problem) return setError(problem);
        start(async () => {
          const r = await setPublicName(name);
          if (!r.ok) return setError(r.message);
          setSaved(true);
          router.refresh();
        });
      }}
    >
      <label htmlFor="public-name" className={compact ? "text-sm font-semibold" : "label"}>
        {compact ? "Add your name so voters know who made it" : "Name on your entries"}
      </label>
      <div className="flex gap-2">
        <input
          id="public-name"
          className="input"
          maxLength={30}
          value={name}
          placeholder="Chef Dan"
          onChange={(e) => {
            setName(e.target.value);
            setError("");
            setSaved(false);
          }}
        />
        <button className="btn btn-primary shrink-0" disabled={pending}>
          {pending ? "Saving…" : saved ? "Saved" : "Save"}
        </button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-chili">
          {error}
        </p>
      ) : (
        <p className="text-xs text-muted">Shown publicly on your entries and the leaderboard. Without one you appear as &ldquo;A Plateful cook.&rdquo;</p>
      )}
    </form>
  );
}
