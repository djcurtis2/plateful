"use client";
import { useEffect } from "react";
import Link from "next/link";

/** Shown when a page crashes: a friendly apology with Try again, instead of Next.js's bare error screen. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex max-w-md flex-col items-center gap-4 py-24 text-center">
      <h1 className="font-display text-4xl font-bold tracking-tight">Something burned</h1>
      <p className="text-muted">That page hit a snag on our end. Try again, and if it keeps happening, come back in a bit.</p>
      <div className="flex gap-2">
        <button type="button" onClick={reset} className="btn btn-primary">
          Try again
        </button>
        <Link href="/" className="btn btn-ghost">
          Home
        </Link>
      </div>
      {error.digest && <p className="font-mono text-xs text-muted">Ref: {error.digest}</p>}
    </main>
  );
}
