"use client";
import { useEffect, useState } from "react";
import { parseResult } from "@/lib/kroger";

/**
 * Sends a shopping list to the shopper's own Kroger cart: Kroger sign-in, then one of each item goes in.
 * Shows how it went when Kroger sends them back (?kroger=… on this page).
 */
export function KrogerCartButton({ items }: { items: string[] }) {
  const [back, setBack] = useState("/");
  const [result, setResult] = useState<ReturnType<typeof parseResult>>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    setResult(parseResult(url.searchParams.get("kroger")));
    url.searchParams.delete("kroger");
    const clean = url.pathname + url.search + url.hash;
    setBack(clean);
    if (url.href !== window.location.href) window.history.replaceState(null, "", clean);
  }, []);

  const message =
    result === null
      ? null
      : result === "error"
        ? "Kroger didn't take the list. Try again, or use the item links."
        : result === "cancel"
          ? "Kroger sign-in was cancelled. Nothing was added."
          : result === "off"
            ? "Sending to Kroger isn't available yet."
            : result.added === 0
              ? "We couldn't match these items at Kroger. Use the item links instead."
              : `Added ${result.added} of ${result.of} items to your Kroger cart.`;
  const ok = result !== null && typeof result === "object" && result.added > 0;

  return (
    <div className="flex flex-col gap-2">
      <form action="/api/kroger/start" method="post">
        <input type="hidden" name="items" value={JSON.stringify(items)} />
        <input type="hidden" name="back" value={back} />
        <button type="submit" className="btn btn-primary w-full" disabled={!items.length}>
          Send to my Kroger cart
        </button>
      </form>
      <p className="text-xs text-muted">
        You&apos;ll sign in at Kroger and pick your store. We add one of each item; check sizes and amounts in your cart before you check out.
      </p>
      {message && (
        <p role="status" className={`text-sm font-semibold ${ok ? "text-basil" : "text-chili"}`}>
          {message}
          {ok && (
            <>
              {" "}
              <a href="https://www.kroger.com/cart" target="_blank" rel="noopener noreferrer" className="underline">
                Open my cart
              </a>
            </>
          )}
        </p>
      )}
    </div>
  );
}
