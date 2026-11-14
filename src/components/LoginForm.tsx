"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { openExternal, useIsApp } from "@/lib/native";
import { appOAuthRedirect } from "@/lib/auth-links";
import { signInWithApple } from "@/lib/apple-signin";

/** Apple sign-in shows only once the Supabase Apple provider works (set NEXT_PUBLIC_APPLE_SIGNIN=1, then redeploy). */
const APPLE_SIGNIN = process.env.NEXT_PUBLIC_APPLE_SIGNIN === "1";

export function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");
  const inApp = useIsApp();

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
    setState("sending");
    try {
      const supabase = createClient();
      if (inApp) {
        // Google blocks sign-in inside the app's web view: open it in the browser sheet. It comes back on the
        // app's own link, and AppFlag finishes it here, where the sign-in started.
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { skipBrowserRedirect: true, redirectTo: appOAuthRedirect(next) },
        });
        if (error || !data.url) throw error ?? new Error("no url");
        await openExternal(data.url);
        setState("idle");
        return;
      }
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
      });
      if (error) throw error;
      // Success navigates away to Google; leave the button disabled until then.
    } catch {
      setState("error");
      setMessage("Google sign-in isn't working right now. Use the email link instead.");
    }
  }

  async function apple() {
    setState("sending");
    const { error } = await signInWithApple(next);
    if (error) {
      setState("error");
      setMessage(error);
    } else if (inApp) {
      setState("idle"); // cancelled, or already heading to `next`
    }
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
      <button onClick={google} className="btn btn-ghost" disabled={state === "sending"}>
        Continue with Google
      </button>
      {APPLE_SIGNIN && (
        <button onClick={apple} className="btn btn-ghost" disabled={state === "sending"}>
          Continue with Apple
        </button>
      )}
      {APPLE_SIGNIN && inApp && <p className="text-sm text-muted">Already use Yumjack? Sign in with email or Google first, then connect Apple in your account.</p>}
    </div>
  );
}
