"use client";
import { useState } from "react";

export function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-xl bg-sunk py-1.5 pl-3 pr-1.5 font-mono text-sm">
      <input readOnly value={value} aria-label={label} className="min-w-0 flex-1 bg-transparent outline-none" onFocus={(e) => e.target.select()} />
      <button
        className="btn btn-ghost btn-sm"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {}
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
