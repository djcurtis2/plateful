"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { blockCook, unblockCook } from "@/app/actions";

/** "Block this cook" (sits next to Report) or, on the account page, "Unblock". */
export function BlockCookButton({ userId, mode = "block", className }: { userId: string; mode?: "block" | "unblock"; className?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const unblock = mode === "unblock";

  function run() {
    if (!unblock && !window.confirm("You won't see their posts, photos or name. They won't be told.")) return;
    start(async () => {
      const r = unblock ? await unblockCook(userId) : await blockCook(userId);
      if (r.ok) router.refresh();
      else setError(r.message);
    });
  }

  return (
    <span className="flex flex-col items-start gap-0.5">
    <button
      type="button"
      className={className ?? "self-start text-[11px] text-muted underline-offset-2 hover:underline disabled:no-underline"}
      disabled={pending}
      onClick={run}
    >
      {unblock ? "Unblock" : "Block this cook"}
    </button>
    {error && <span role="alert" className="text-[11px] text-muted">{error}</span>}
    </span>
  );
}
