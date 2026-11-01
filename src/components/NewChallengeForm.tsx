"use client";
import { useState, useTransition } from "react";
import { createChallenge } from "@/app/admin/actions";

export function NewChallengeForm({ defaultStart, defaultEnd }: { defaultStart: string; defaultEnd: string }) {
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        // datetime-local has no zone; send it as the admin's local time.
        for (const k of ["startsAt", "endsAt"]) fd.set(k, new Date(String(fd.get(k))).toISOString());
        start(async () => setMsg((await createChallenge(fd)).message ?? ""));
      }}
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="label">Title</span>
        <input name="title" className="input" required placeholder="Panda Express-style orange chicken" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="label">Recipe page URL or slug</span>
        <input name="recipeSlug" className="input" required placeholder="/r/panda-express-orange-chicken-ab12cd" />
      </label>
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        <span className="label">Blurb</span>
        <input name="blurb" className="input" maxLength={200} placeholder="Beat $10.50 a plate." />
      </label>
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        <span className="label">Photo of the real dish (optional)</span>
        <input name="reference" type="file" accept="image/jpeg,image/png,image/webp" className="text-sm" />
        <span className="text-xs text-muted">What voters compare copies against. Use a photo you took or have rights to. Without one, the snapped recipe photo is used.</span>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="label">Starts</span>
        <input name="startsAt" type="datetime-local" className="input" defaultValue={defaultStart} required />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="label">Voting closes</span>
        <input name="endsAt" type="datetime-local" className="input" defaultValue={defaultEnd} required />
      </label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button className="btn btn-primary" disabled={pending}>
          {pending ? "Scheduling…" : "Schedule cook-off"}
        </button>
        {msg && <span className="text-sm text-muted">{msg}</span>}
      </div>
    </form>
  );
}
