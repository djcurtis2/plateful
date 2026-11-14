"use client";
import { useEffect, useState, useTransition } from "react";
import { setNotify } from "@/app/account/actions";
import { enablePush, useIsApp } from "@/lib/native";
import { pushError } from "@/components/NotifyToggles";

const KINDS = {
  trivia: { kind: "daily_games", key: "yj_push_prompt_trivia", text: "Want a ping when tomorrow's trivia is ready?" },
  plan: { kind: "plan_dinner", key: "yj_push_prompt_plan", text: "Want a reminder of tonight's dinner?" },
} as const;

function remembered(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}
function remember(key: string) {
  try {
    localStorage.setItem(key, "1");
  } catch {
    // private mode: it may show again, which is fine
  }
}

/** A one-time, dismissible ask inside the iPhone app. Hidden once answered, dismissed, or already on. */
export function PushPrompt({ which, alreadyOn }: { which: keyof typeof KINDS; alreadyOn: boolean }) {
  const isApp = useIsApp();
  const cfg = KINDS[which];
  const [hidden, setHidden] = useState(true); // until localStorage is read
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  useEffect(() => setHidden(alreadyOn || remembered(cfg.key)), [alreadyOn, cfg.key]);
  if (!isApp || hidden) return null;

  function close() {
    remember(cfg.key);
    setHidden(true);
  }

  function yes() {
    setError("");
    start(async () => {
      const got = await enablePush();
      if (got !== "ok") return setError(pushError(got));
      const r = await setNotify(cfg.kind, true);
      if (!r.ok) return setError(r.message);
      close();
    });
  }

  return (
    <div className="card flex flex-col gap-2 p-4" role="region" aria-label="Notifications">
      <p className="font-semibold">{cfg.text}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary btn-sm" onClick={yes} disabled={pending}>
          Yes, notify me
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={close} disabled={pending}>
          Not now
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-chili">
          {error}
        </p>
      )}
    </div>
  );
}
