"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { connectApple } from "@/lib/apple-signin";

/** "Connect Apple" on the account page, so later Apple sign-ins (even with a hidden email) open this account. */
export function ConnectApple() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onClick() {
    setBusy(true);
    setError("");
    const { error, done } = await connectApple();
    if (error) setError(error);
    if (done) router.refresh(); // the button disappears once Apple is linked
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="label">Sign in with Apple</span>
          <p className="text-sm text-muted">Connect your Apple ID to sign in to this account with Apple.</p>
        </div>
        <button onClick={onClick} className="btn btn-ghost btn-sm" disabled={busy}>
          {busy ? "Connecting…" : "Connect Apple"}
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
