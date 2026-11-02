"use client";
import { celebrate, here } from "@/lib/celebrate";
import { useState, useTransition } from "react";

/** Runs an admin server action and shows its result inline. Two-step confirm for actions that can't be undone. */
export function AdminButton({
  action,
  label,
  confirm,
  className = "btn btn-ghost btn-sm",
  cheer = false,
}: {
  /** Confetti on success, using the result message as the label. */
  cheer?: boolean;
  action: () => Promise<{ ok: boolean; message?: string }>;
  label: string;
  confirm?: string;
  className?: string;
}) {
  const [msg, setMsg] = useState("");
  const [arming, setArming] = useState(false);
  const [pending, start] = useTransition();
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        className={className}
        disabled={pending}
        onClick={() => {
          if (confirm && !arming) return setArming(true);
          setArming(false);
          const at = here();
          start(async () => {
            const r = await action();
            if (r.ok && cheer) celebrate({ text: r.message?.replace(/^Saved \$/, "+$").replace(/^\+\$([\d.]+)$/, "+$$$1 saved"), origin: at });
            setMsg(r.message ?? (r.ok ? "Done" : "Failed"));
          });
        }}
      >
        {pending ? "Working…" : arming ? `Confirm: ${label}` : label}
      </button>
      {arming && <span className="text-xs text-chili">{confirm}</span>}
      {msg && <span className="text-xs text-muted">{msg}</span>}
    </span>
  );
}
