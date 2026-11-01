"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setState("error");
      setMessage("Enter a valid email address.");
      return;
    }
    setState("sending");
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
    if (error) {
      setState("error");
      setMessage(error.message.includes("rate") ? "Too many tries. Wait a minute and try again." : "We couldn't send the link. Check the address and try again.");
      return;
    }
    setState("sent");
  }

  async function google() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
  }

  if (state === "sent") {
    return (
      <div className="rounded-2xl border border-line bg-surface p-6">
        <h2 className="font-display text-xl font-bold">Check your email</h2>
        <p className="mt-1 text-muted">
          We sent a sign-in link to <span className="font-medium text-ink">{email}</span>. Open it on this device.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
        <label htmlFor="email" className="label">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (state === "error") setState("idle");
          }}
          className="input"
          placeholder="you@example.com"
        />
        {state === "error" && (
          <p role="alert" className="text-sm text-chili">
            {message}
          </p>
        )}
        <button className="btn btn-primary" disabled={state === "sending"}>
          {state === "sending" ? "Sending…" : "Email me a sign-in link"}
        </button>
      </form>
      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-line" />
        or
        <span className="h-px flex-1 bg-line" />
      </div>
      <button onClick={google} className="btn btn-ghost">
        Continue with Google
      </button>
    </div>
  );
}
