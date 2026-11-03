"use client";
import { useState } from "react";

/** Shares a spoiler-free result: the phone's share sheet, or copies it on desktop. */
export function ShareButton({ text, label = "Share my result", className = "btn btn-primary" }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          if (navigator.share) await navigator.share({ text });
          else {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }
        } catch {
          // Closed the share sheet: nothing to do.
        }
      }}
    >
      {copied ? "Copied!" : label}
    </button>
  );
}
