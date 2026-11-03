"use client";
import { useState, useTransition } from "react";
import { setFeatureMe } from "@/app/actions";

/** Opt in to being named in Dupe Kitchen stories and ads. Off by default. */
export function FeatureMeToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <label className="flex cursor-pointer items-start gap-3 text-sm">
      <input
        type="checkbox"
        checked={on}
        disabled={pending}
        className="mt-0.5 size-4 accent-[var(--basil)]"
        onChange={(e) => {
          const next = e.target.checked;
          setOn(next);
          start(async () => {
            const r = await setFeatureMe(next);
            if (!r.ok) setOn(!next);
          });
        }}
      />
      <span>
        <b>Feature me</b>
        <span className="block text-muted">Dupe Kitchen may share my public name and savings in stories and ads, like &ldquo;Dan has saved $1,240 cooking at home.&rdquo; Off unless you tick it.</span>
      </span>
    </label>
  );
}
