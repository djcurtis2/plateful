"use client";
import { useState, useTransition } from "react";
import { GEAR } from "@/lib/avatar";

type R = { ok: boolean; message?: string };
const SHOP = GEAR.filter((g) => g.source.kind === "shop");

/** Admin: grant or take back one shop item by user id. */
export function AdminGearForm({ grant, remove }: { grant: (userId: string, itemId: string) => Promise<R>; remove: (userId: string, itemId: string) => Promise<R> }) {
  const [userId, setUserId] = useState("");
  const [itemId, setItemId] = useState(SHOP[0]?.id ?? "");
  const [msg, setMsg] = useState("");
  const [arming, setArming] = useState(false);
  const [pending, start] = useTransition();

  const run = (fn: typeof grant) =>
    start(async () => {
      setMsg("");
      const r = await fn(userId.trim(), itemId);
      setMsg(r.message ?? (r.ok ? "Done" : "Failed"));
    });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="label">User id</span>
          <input className="input w-80 max-w-full font-mono text-xs" value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="00000000-0000-0000-0000-000000000000" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="label">Item</span>
          <select className="input" value={itemId} onChange={(e) => setItemId(e.target.value)}>
            {SHOP.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </label>
        <button className="btn btn-primary btn-sm" disabled={pending || !userId.trim()} onClick={() => { setArming(false); run(grant); }}>
          Grant
        </button>
        <button
          className="btn btn-ghost btn-sm"
          disabled={pending || !userId.trim()}
          onClick={() => {
            if (!arming) return setArming(true);
            setArming(false);
            run(remove);
          }}
        >
          {arming ? "Confirm: Remove" : "Remove"}
        </button>
      </div>
      <p role="status" className="min-h-5 text-sm text-muted">{pending ? "Working…" : msg}</p>
    </div>
  );
}
