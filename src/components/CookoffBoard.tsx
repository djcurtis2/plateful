"use client";
import { celebrate, here } from "@/lib/celebrate";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Attempt } from "@/lib/data";
import type { Recipe } from "@/lib/recipe";
import { POINTS, publicName, rankEntries, VOTES_PER_COOKOFF } from "@/lib/game";
import { reportAttempt, voteAttempt } from "@/app/actions";
import { ShareCard } from "@/components/ShareCard";
import { ChefAvatar } from "@/components/ChefAvatar";
import { ClubBadge } from "@/components/ClubBadge";
import { EntryChips } from "@/components/EntryChips";

type Props = {
  entries: Attempt[];
  recipe: Recipe;
  myId: string | null;
  myVotes: string[];
  open: boolean; // voting still open
  chefPickId: string | null;
  crowdWinnerId: string | null;
  thriftiestId: string | null;
  referenceUrl: string | null; // the real dish, shown beside every copy
  siteUrl: string;
  refCode: string | null;
  loginNext: string;
};

export function entryUrl(siteUrl: string, id: string, refCode: string | null) {
  return `${siteUrl}/cookoff/e/${id}${refCode ? `?ref=${refCode}` : ""}`;
}

export function CookoffBoard({ entries, recipe, myId, myVotes, open, chefPickId, crowdWinnerId, thriftiestId, referenceUrl, siteUrl, refCode, loginNext }: Props) {
  const [sort, setSort] = useState<"top" | "new">("top");
  const [votes, setVotes] = useState<Record<string, number>>(() => Object.fromEntries(entries.map((e) => [e.id, e.votes])));
  const [mine, setMine] = useState<Set<string>>(() => new Set(myVotes));
  const [msg, setMsg] = useState("");
  const [sharing, setSharing] = useState<Attempt | null>(null);
  const [reported, setReported] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const panel = useRef<HTMLDivElement>(null);

  // Bring the share panel into view once it opens (it sits above the entries, not at the top of the page).
  useEffect(() => {
    if (sharing) panel.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [sharing]);

  const left = VOTES_PER_COOKOFF - mine.size;
  const ranked = useMemo(() => rankEntries(entries.map((e) => ({ ...e, votes: votes[e.id] ?? e.votes }))), [entries, votes]);
  const rankOf = useMemo(() => Object.fromEntries(ranked.map((e, i) => [e.id, i + 1])), [ranked]);
  const shown = sort === "top" ? ranked : [...ranked].sort((a, b) => b.created_at.localeCompare(a.created_at));

  function vote(id: string) {
    if (!myId) {
      setMsg("login");
      return;
    }
    const at = here();
    start(async () => {
      const r = await voteAttempt(id);
      if (!r.ok) return setMsg(r.message);
      if (r.voted) celebrate({ text: `+${POINTS.vote_cast} points`, origin: at });
      setMsg("");
      setVotes((v) => ({ ...v, [id]: r.votes }));
      setMine((m) => {
        const n = new Set(m);
        if (r.voted) n.add(id);
        else n.delete(id);
        return n;
      });
    });
  }

  if (!entries.length) return <p className="text-muted">No entries yet. Be the first to post.</p>;

  return (
    <div className="flex flex-col gap-4">
      {sharing && (
        <div ref={panel} className="card flex scroll-mt-20 flex-col gap-4 border-basil p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-display text-xl font-bold">Rally your votes</p>
              <p className="text-sm text-muted">Your link opens your entry with a Vote button. Friends who sign up to vote count toward your free months.</p>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setSharing(null)}>
              Close
            </button>
          </div>
          <div className="mx-auto w-full max-w-sm">
            <ShareCard key={sharing.id} recipe={recipe} shareUrl={entryUrl(siteUrl, sharing.id, refCode)} initialAttempt={sharing.image_url} cta="Vote for me" chef={sharing.chef.avatar} />
          </div>
        </div>
      )}

      {open && (
        <p className="rounded-2xl bg-sunk px-4 py-3 text-sm">
          <b>How to vote:</b> pick the {VOTES_PER_COOKOFF} copies that look closest to the original{recipe.restaurant ? ` from ${recipe.restaurant}` : ""}. Price and time are there to help, but looks win.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Sort entries" className="grid grid-cols-2 gap-1 rounded-xl bg-sunk p-1 text-sm">
          {(["top", "new"] as const).map((k) => (
            <button
              key={k}
              aria-pressed={sort === k}
              onClick={() => setSort(k)}
              className={`rounded-lg px-4 py-1.5 font-semibold ${sort === k ? "bg-surface text-ink shadow-sm" : "text-muted"}`}
            >
              {k === "top" ? "Top" : "New"}
            </button>
          ))}
        </div>
        {open && myId && (
          <p className="flex items-center gap-2 text-sm" aria-live="polite">
            <span className="flex gap-1" aria-hidden>
              {Array.from({ length: VOTES_PER_COOKOFF }, (_, i) => (
                <span key={i} className={`size-3 rounded-full ${i < left ? "bg-saffron" : "bg-line"}`} />
              ))}
            </span>
            {left} of {VOTES_PER_COOKOFF} votes left
          </p>
        )}
      </div>

      {msg === "login" ? (
        <p className="rounded-2xl bg-sunk px-4 py-3 text-sm">
          <Link href={`/login?next=${encodeURIComponent(loginNext)}`} className="font-semibold text-basil underline">
            Sign in
          </Link>{" "}
          to vote. Everyone gets {VOTES_PER_COOKOFF} votes per cook-off.
        </p>
      ) : msg ? (
        <p role="alert" className="rounded-2xl bg-sunk px-4 py-3 text-sm">
          {msg}
        </p>
      ) : null}

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {shown.map((a) => {
          const isMine = !!myId && a.user_id === myId;
          const voted = mine.has(a.id);
          const rank = rankOf[a.id];
          return (
            <li key={a.id} className={`card flex min-w-0 flex-col overflow-hidden ${isMine ? "border-basil" : ""}`}>
              <Link href={`/cookoff/e/${a.id}`} className="relative grid aspect-[4/3] grid-cols-[2fr_3fr] gap-0.5 bg-line">
                <span className="relative bg-sunk">
                  {referenceUrl && <Image src={referenceUrl} alt="" fill sizes="(max-width: 640px) 20vw, 10vw" className="object-cover" />}
                  <span className="absolute bottom-1.5 left-1.5 rounded bg-ink/75 px-1 py-px font-mono text-[10px] font-semibold text-bg">Original</span>
                </span>
                <span className="relative bg-sunk">
                  <Image src={a.image_url} alt={a.caption ?? `${publicName(a.name)}'s version`} fill sizes="(max-width: 640px) 30vw, 15vw" className="object-cover" />
                  <span className="absolute bottom-1.5 left-1.5 rounded bg-ink/75 px-1 py-px font-mono text-[10px] font-semibold text-bg">Copy</span>
                </span>
                <span className="absolute left-2 top-2 flex flex-wrap gap-1">
                  {sort === "top" && (votes[a.id] ?? 0) > 0 && (
                    <span className="rounded-md bg-ink/80 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-bg">#{rank}</span>
                  )}
                  {isMine && <span className="rounded-md bg-basil px-1.5 py-0.5 font-mono text-[11px] font-semibold text-basil-ink">Yours</span>}
                  {a.id === crowdWinnerId && <span className="rounded-md bg-saffron px-1.5 py-0.5 font-mono text-[11px] font-semibold text-saffron-ink">Crowd favorite</span>}
                  {a.id === chefPickId && <span className="rounded-md bg-saffron px-1.5 py-0.5 font-mono text-[11px] font-semibold text-saffron-ink">Chef&apos;s pick</span>}
                  {a.id === thriftiestId && <span className="rounded-md bg-saffron px-1.5 py-0.5 font-mono text-[11px] font-semibold text-saffron-ink">Thriftiest</span>}
                </span>
              </Link>
              <div className="flex flex-col gap-2 p-3">
                <div className="flex min-w-0 items-center gap-2">
                  <ChefAvatar avatar={a.chef.avatar} head size={36} uid={`${a.user_id}-board`} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{publicName(a.name)}</p>
                    {a.caption && <p className="truncate text-xs text-muted">{a.caption}</p>}
                  </div>
                </div>
                {a.chef.clubs.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {a.chef.clubs.slice(0, 2).map((c) => (
                      <ClubBadge key={c} id={c} />
                    ))}
                  </div>
                )}
                <EntryChips e={a} />
                <div className="flex items-center justify-between gap-1.5">
                  {isMine ? (
                    <button className="btn btn-primary btn-sm px-2.5 py-1" onClick={() => setSharing(a)}>
                      Get votes
                    </button>
                  ) : open ? (
                    <button
                      className={`btn btn-sm px-2.5 py-1 ${voted ? "btn-sun" : "btn-ghost"}`}
                      aria-pressed={voted}
                      disabled={pending || (!voted && left === 0 && !!myId)}
                      title={!voted && left === 0 ? "You've used all your votes" : undefined}
                      onClick={() => vote(a.id)}
                    >
                      {voted ? "Voted ✓" : "Vote"}
                    </button>
                  ) : (
                    <span />
                  )}
                  <span className="tabular font-mono text-sm" aria-label={`${votes[a.id] ?? 0} votes`}>
                    ▲ {votes[a.id] ?? 0}
                  </span>
                </div>
                {!isMine && myId && (
                  <button
                    className="self-start text-[11px] text-muted underline-offset-2 hover:underline disabled:no-underline"
                    disabled={reported.has(a.id)}
                    onClick={() =>
                      start(async () => {
                        const r = await reportAttempt(a.id, "");
                        if (r.ok) setReported((s) => new Set(s).add(a.id));
                      })
                    }
                  >
                    {reported.has(a.id) ? "Reported. Thanks" : "Report"}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
