"use client";

/** Last resort when the root layout itself fails: no header, fonts or theme are available here, so it is plain. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0, textAlign: "center" }}>
        <div>
          <h1>Something burned</h1>
          <p>Yumjack hit a snag. Try again in a moment.</p>
          <button type="button" onClick={reset} style={{ padding: "8px 16px", cursor: "pointer" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
