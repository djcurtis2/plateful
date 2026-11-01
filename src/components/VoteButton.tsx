"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { voteAttempt } from "@/app/actions";
import { VOTES_PER_COOKOFF } from "@/lib/game";

/** The big vote button on an entry page. Signed-out visitors are sent to sign in, then back here. */
export function VoteButton({
  attemptId,
  initialVotes,
  initialVoted,
  initialLeft,
  signedIn,
  open,
  own,
  next,
}: {
  attemptId: string;
  initialVotes: number;
  initialVoted: boolean;
  initialLeft: number;
  signedIn: boolean;
  open: boolean;
  own: boolean;
  next: string;
}) {
  const [votes, setVotes] = useState(initialVotes);
  const [voted, setVoted] = useState(initialVoted);
  const [left, setLeft] = useState(initialLeft);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();

  const count = (
    <p className="tabular font-mono text-3xl font-semibold">
      ▲ {votes} <span className="text-base font-normal text-muted">{votes === 1 ? "vote" : "votes"}</span>
    </p>
  );

  if (!open) return <div className="flex flex-col gap-1">{count}<p className="text-sm text-muted">Voting has closed.</p></div>;
  if (own) return <div className="flex flex-col gap-1">{count}<p className="text-sm text-muted">This is your entry. Share it to collect votes.</p></div>;

  if (!signedIn) {
    return (
      <div className="flex flex-col gap-2">
        {count}
        <Link href={`/login?next=${encodeURIComponent(next)}`} className="btn btn-sun text-lg">
          Sign in free to vote
        </Link>
        <p className="text-xs text-muted">Takes 10 seconds with your email. Everyone gets {VOTES_PER_COOKOFF} votes per cook-off.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {count}
      <button
        className={`btn text-lg ${voted ? "btn-ghost" : "btn-sun"}`}
        aria-pressed={voted}
        disabled={pending || (!voted && left === 0)}
        onClick={() =>
          start(async () => {
            const r = await voteAttempt(attemptId);
            if (!r.ok) return setMsg(r.message);
            setMsg("");
            setVotes(r.votes);
            setVoted(r.voted);
            setLeft(r.remaining);
          })
        }
      >
        {pending ? "Saving…" : voted ? "Voted ✓ (tap to take it back)" : left === 0 ? "No votes left" : "Vote for this one"}
      </button>
      <p className="text-xs text-muted" aria-live="polite">
        {msg || `${left} of ${VOTES_PER_COOKOFF} votes left this week`}
      </p>
    </div>
  );
}
