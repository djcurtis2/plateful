"use client";
import { useState } from "react";

export function WaitlistForm({ source = "home" }: { source?: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot: hidden from people, bots fill it

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setState("error");
      setMessage("Enter a valid email address.");
      return;
    }
    setState("sending");
    const res = await fetch("/api/waitlist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, source, website }),
    }).catch(() => null);
    if (!res || !res.ok) {
      setState("error");
      setMessage(res?.status === 429 ? "That's a lot of sign-ups from here today. Try again tomorrow." : "We couldn't add you just now. Try again.");
      return;
    }
    setState("done");
  }

  if (state === "done") return <p className="rounded-2xl bg-basil-ink/10 px-4 py-3 font-medium">You&apos;re in. First copycat lands this week.</p>;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2" noValidate>
      <label htmlFor="wl-email" className="sr-only">
        Email
      </label>
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
      />
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="wl-email"
          type="email"
          autoComplete="email"
          className="input flex-1"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (state === "error") setState("idle");
          }}
        />
        <button className="btn btn-sun" disabled={state === "sending"}>
          {state === "sending" ? "Adding…" : "Get the weekly copycat"}
        </button>
      </div>
      {state === "error" && (
        <p role="alert" className="text-sm font-medium">
          {message}
        </p>
      )}
    </form>
  );
}
