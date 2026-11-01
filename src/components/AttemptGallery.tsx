"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import type { Attempt } from "@/lib/data";
import type { Recipe } from "@/lib/recipe";
import { voteAttempt } from "@/app/actions";
import { ShareCard } from "@/components/ShareCard";

type Props = {
  attempts: Attempt[];
  signedIn: boolean;
  voting?: boolean;
  myId?: string | null;
  recipe: Recipe;
  shareUrl: string;
};

export function AttemptGallery({ attempts, signedIn, voting = false, myId = null, recipe, shareUrl }: Props) {
  const [votes, setVotes] = useState<Record<string, number>>(() => Object.fromEntries(attempts.map((a) => [a.id, a.votes])));
  const [sharing, setSharing] = useState<Attempt | null>(null);
  const [msg, setMsg] = useState("");
  const [, start] = useTransition();
  const panel = useRef<HTMLDivElement>(null);

  // Bring the share card into view once it renders, wherever the gallery sits on the page.
  useEffect(() => {
    if (sharing) panel.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [sharing]);

  if (!attempts.length) return null;

  return (
    <div className="flex flex-col gap-3">
      {sharing && (
        <div ref={panel} className="card flex scroll-mt-20 flex-col gap-4 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-display text-xl font-bold">Share your card</p>
              <p className="text-sm text-muted">Friends who cook from your link earn you free months.</p>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setSharing(null)}>
              Close
            </button>
          </div>
          <div className="mx-auto w-full max-w-sm">
            <ShareCard key={sharing.id} recipe={recipe} shareUrl={shareUrl} initialAttempt={sharing.image_url} />
          </div>
        </div>
      )}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {attempts.map((a) => {
          const mine = !!myId && a.user_id === myId;
          return (
            <li key={a.id} className={`card flex min-w-0 flex-col overflow-hidden ${mine ? "border-basil" : ""}`}>
              <div className="relative aspect-square bg-sunk">
                <Image src={a.image_url} alt={a.caption ?? "A cook's attempt"} fill sizes="(max-width: 640px) 50vw, 25vw" className="object-cover" />
                {mine && (
                  <span className="absolute left-2 top-2 rounded-md bg-basil px-2 py-0.5 font-mono text-[11px] font-semibold text-basil-ink">
                    Yours
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-2 p-3">
                <p className="min-w-0 truncate text-sm">{a.caption ?? "\u00a0"}</p>
                <div className="flex shrink-0 gap-1.5">
                  {mine && (
                    <button
                      className="btn btn-primary btn-sm px-2.5 py-1"
                      onClick={() => {
                        setSharing(a);
                        panel.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                    >
                      Share
                    </button>
                  )}
                  {voting && (
                    <button
                      className="btn btn-ghost btn-sm px-2 py-1 font-mono"
                      aria-label="Vote for this attempt"
                      onClick={() => {
                        if (!signedIn) return setMsg("Sign in to vote.");
                        start(async () => {
                          const r = await voteAttempt(a.id);
                          if (r.ok) setVotes((v) => ({ ...v, [a.id]: r.votes }));
                          else setMsg(r.message);
                        });
                      }}
                    >
                      ▲ {votes[a.id]}
                    </button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {msg && <p className="text-sm text-muted">{msg}</p>}
    </div>
  );
}
