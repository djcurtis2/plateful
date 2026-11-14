"use client";
import { useState, useTransition } from "react";
import { setNotify } from "@/app/account/actions";
import { enablePush, useIsApp } from "@/lib/native";

export const PUSH_DENIED = "Notifications are off for Yumjack in your iPhone Settings.";
export const PUSH_FAILED = "Couldn't turn on notifications. Try again.";
export const pushError = (r: "denied" | "failed") => (r === "denied" ? PUSH_DENIED : PUSH_FAILED);

type Kind = "daily_games" | "plan_dinner";
const ROWS: { kind: Kind; label: string }[] = [
  { kind: "daily_games", label: "Daily trivia and games are ready" },
  { kind: "plan_dinner", label: "Tonight's dinner from my plan" },
];

/** Account page, iPhone app only: choose which notifications to get. All off until the cook turns one on. */
export function NotifyToggles({ initial }: { initial: Record<Kind, boolean> }) {
  const isApp = useIsApp();
  const [on, setOn] = useState(initial);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  if (!isApp) return null;

  function change(kind: Kind, next: boolean) {
    setError("");
    start(async () => {
      // Turning one on asks iPhone for permission first; if it says no, nothing is saved.
      const got = next ? await enablePush() : "ok";
      if (got !== "ok") {
        setError(pushError(got));
        return;
      }
      const r = await setNotify(kind, next);
      if (!r.ok) return setError(r.message);
      setOn((prev) => ({ ...prev, [kind]: next }));
    });
  }

  return (
    <section className="card flex flex-col gap-3 p-6">
      <div>
        <span className="label">Notifications</span>
        <p className="text-sm text-muted">Off until you turn them on. At most one of each a day.</p>
      </div>
      {ROWS.map((r) => (
        <label key={r.kind} className="flex cursor-pointer items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={on[r.kind]}
            disabled={pending}
            className="size-4 accent-[var(--basil)]"
            onChange={(e) => change(r.kind, e.target.checked)}
          />
          <span className="font-medium">{r.label}</span>
        </label>
      ))}
      {error && (
        <p role="alert" className="text-sm text-chili">
          {error}
        </p>
      )}
    </section>
  );
}
