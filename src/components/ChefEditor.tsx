"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveChef, setClubs } from "@/app/chef/actions";
import { ChefAvatar } from "@/components/ChefAvatar";
import { LOOK_NAMES } from "@/components/chef/look";
import { CLUBS, MAX_CLUBS } from "@/lib/clubs";
import {
  BUNDLES, CHEF_TABS, GEAR, GEAR_BY_ID, canSave, visibleAvatar, LOOK_OPTIONS, SLOTS, lockReason, priceLabel, purchasable, singlesCents,
  type Avatar, type ChefTab, type GearItem, type LookPart, type Rarity, type Slot,
} from "@/lib/avatar";

const PART_LABELS: Record<LookPart, string> = {
  skin: "Skin", eyes: "Eyes", brows: "Brows", mouth: "Mouth", hair: "Hair", hairColor: "Hair color", facialHair: "Facial hair", glasses: "Glasses",
};
const PARTS = Object.keys(LOOK_OPTIONS) as LookPart[];
const SLOT_LABELS: Record<Slot, string> = { hat: "Hats", outfit: "Outfits", tool: "Tools", background: "Backgrounds" };
// Theme tokens only, so every rarity reads in light and dark mode.
const RARITY_BORDER: Record<Rarity, string> = {
  common: "border-line",
  rare: "border-basil",
  epic: "border-saffron",
  legendary: "border-chili border-2",
};

/** The avatar wearing these items on top (or with a slot emptied when the id is null). */
function wearing(avatar: Avatar, items: (GearItem | { slot: Slot; id: null })[]): Avatar {
  const equipped = { ...avatar.equipped };
  for (const g of items) {
    if (g.id === null) delete equipped[g.slot];
    else equipped[g.slot] = g.id;
  }
  return { ...avatar, equipped };
}

/** A small chef wearing one item, so gear is never picked or bought sight-unseen. Hats read best as a head crop. */
function TileChef({ avatar, slot, uid }: { avatar: Avatar; slot: Slot; uid: string }) {
  return (
    <span className="flex h-16 w-full items-center justify-center rounded-xl bg-sunk">
      <ChefAvatar avatar={avatar} head={slot === "hat"} size={slot === "hat" ? 56 : 60} uid={uid} />
    </span>
  );
}

type Props = {
  initial: Avatar;
  unlocked: string[];
  clubs: string[];
  saved: boolean;
  plus: boolean;
  owned: string[];
  tab: ChefTab;
};

export function ChefEditor({ initial, unlocked, clubs: initialClubs, saved, plus, owned, tab }: Props) {
  const router = useRouter();
  const [avatar, setAvatar] = useState<Avatar>(initial);
  const [base, setBase] = useState<Avatar>(initial);
  const [everSaved, setEverSaved] = useState(saved);
  const [clubs, setClubIds] = useState<string[]>(initialClubs);
  const [clubBase, setClubBase] = useState<string[]>(initialClubs);
  const [msg, setMsg] = useState("");
  const [clubMsg, setClubMsg] = useState("");
  const [pending, start] = useTransition();
  // Locked gear tried on the big chef only. Never part of `avatar`, so it can't be saved.
  const [preview, setPreview] = useState<string[]>([]);
  const open = new Set(unlocked);
  const previewItems = preview.map((id) => GEAR_BY_ID[id]).filter((g): g is GearItem => !!g);
  const previewing = previewItems.length > 0;
  // What others see; tiles and the preview draw on top of this.
  const shown = visibleAvatar(avatar, plus);
  // Same rule as the server: gear must be unlocked or unchanged from the saved chef.
  const allowed = canSave(avatar, open, everSaved ? base : undefined).ok;

  const dirty = JSON.stringify(avatar) !== JSON.stringify(base) || !everSaved;
  const clubsDirty = clubs.join("|") !== clubBase.join("|");

  const setLook = (part: LookPart, i: number) => setAvatar((a) => ({ ...a, look: { ...a.look, [part]: i } }));
  const equip = (g: GearItem) => {
    setPreview([]);
    setAvatar((a) => ({ ...a, equipped: { ...a.equipped, [g.slot]: g.id } }));
  };
  const empty = (slot: Slot) => {
    setPreview([]);
    setAvatar((a) => {
      const equipped = { ...a.equipped };
      delete equipped[slot];
      return { ...a, equipped };
    });
  };
  const tryOn = (ids: string[]) => {
    setPreview((p) => (p.join("|") === ids.join("|") ? [] : ids));
    document.getElementById("chef-stage")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const save = () =>
    start(async () => {
      setMsg("");
      const r = await saveChef(avatar);
      if (!r.ok) return setMsg(r.message);
      setBase(avatar);
      setEverSaved(true);
      setMsg("Saved.");
      router.refresh();
    });

  const saveClubs = () =>
    start(async () => {
      setClubMsg("");
      const r = await setClubs(clubs);
      if (!r.ok) return setClubMsg(r.message);
      setClubBase(clubs);
      setClubMsg("Saved.");
      router.refresh();
    });

  const toggleClub = (id: string) =>
    setClubIds((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length >= MAX_CLUBS ? c : [...c, id]));

  return (
    <div className="flex flex-col gap-6">
      <div id="chef-stage" className="card flex flex-col items-center gap-3 p-6">
        <ChefAvatar
          avatar={previewing ? wearing(shown, previewItems) : shown}
          size={260}
          uid="editor"
          title={previewing ? `Your chef previewing ${previewItems.map((g) => g.name).join(", ")}` : "Your chef"}
        />
        {previewing && (
          <p className="flex flex-wrap items-center justify-center gap-2 text-sm">
            <span className="rounded-full bg-saffron px-2 py-0.5 text-xs font-bold uppercase text-saffron-ink">Previewing — locked</span>
            <span className="text-muted">{previewItems.map((g) => g.name).join(", ")}</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPreview([])}>End preview</button>
          </p>
        )}
        {!everSaved && (
          <p className="text-sm text-muted">This chef was picked for you. Make it yours, then save.</p>
        )}
        <div className="flex flex-col items-center gap-1">
          <button className="btn btn-primary" onClick={save} disabled={pending || !dirty || previewing || !allowed}>
            {pending ? "Saving..." : everSaved ? "Save chef" : "Save my chef"}
          </button>
          <p role="status" className={`min-h-5 text-sm ${msg === "Saved." ? "text-basil" : "text-chili"}`}>
            {previewing ? "End the preview to save. Locked gear can't be saved." : !allowed ? "Some gear is locked. Pick gear you have to save." : msg}
          </p>
        </div>
      </div>

      <nav aria-label="Chef sections" className="flex gap-1 rounded-2xl bg-sunk p-1">
        {CHEF_TABS.map((t) => (
          <Link
            key={t.id}
            href={`/chef?tab=${t.id}`}
            scroll={false}
            replace
            aria-current={tab === t.id ? "page" : undefined}
            className={`flex-1 rounded-xl px-3 py-2 text-center text-sm font-semibold ${tab === t.id ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "look" && (
        <section className="card flex flex-col gap-5 p-6">
          {PARTS.map((part) => (
            <div key={part} className="flex flex-col gap-2">
              <span className="label">{PART_LABELS[part]}</span>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: LOOK_OPTIONS[part] }, (_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-pressed={avatar.look[part] === i}
                    onClick={() => setLook(part, i)}
                    className={`rounded-xl border px-3 py-1.5 text-sm ${avatar.look[part] === i ? "border-basil bg-basil text-basil-ink" : "border-line hover:border-basil"}`}
                  >
                    {LOOK_NAMES[part][i] ?? i + 1}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {tab === "wardrobe" && (
        <section className="flex flex-col gap-6">
          {SLOTS.map((slot) => (
            <div key={slot} className="card flex flex-col gap-3 p-6">
              <span className="label">{SLOT_LABELS[slot]}</span>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <li>
                  <button
                    type="button"
                    aria-pressed={avatar.equipped[slot] === undefined}
                    onClick={() => empty(slot)}
                    className={`flex h-full w-full flex-col items-start gap-1 rounded-2xl border border-dashed border-line p-3 text-left hover:bg-sunk ${avatar.equipped[slot] === undefined ? "bg-basil/10 ring-2 ring-basil" : ""}`}
                  >
                    <TileChef avatar={wearing(shown, [{ slot, id: null }])} slot={slot} uid={`tile-${slot}-none`} />
                    <span className="text-sm font-semibold">None</span>
                    <span className="text-xs text-muted">{avatar.equipped[slot] === undefined ? "Nothing on" : "Tap to go without"}</span>
                  </button>
                </li>
                {GEAR.filter((g) => g.slot === slot).map((g) => {
                  const isOpen = open.has(g.id);
                  // Unchanged saved gear (e.g. a lapsed Plus item) can still be worn.
                  const canWear = isOpen || (everSaved && base.equipped[slot] === g.id);
                  const on = avatar.equipped[slot] === g.id;
                  const trying = preview.length === 1 && preview[0] === g.id;
                  const tag = g.source.kind === "shop" ? "Shop" : g.source.kind === "plus" ? "Plus" : null;
                  return (
                    <li key={g.id}>
                      <button
                        type="button"
                        aria-pressed={canWear ? on : trying}
                        aria-label={canWear ? undefined : `Preview ${g.name} (locked: ${lockReason(g)})`}
                        onClick={() => (canWear ? equip(g) : tryOn([g.id]))}
                        className={`flex h-full w-full flex-col items-start gap-1 rounded-2xl border p-3 text-left hover:bg-sunk ${RARITY_BORDER[g.rarity]} ${on ? "bg-basil/10 ring-2 ring-basil" : trying ? "ring-2 ring-saffron" : ""}`}
                      >
                        <span className={`w-full ${canWear ? "" : "opacity-60"}`}>
                          <TileChef avatar={wearing(shown, [g])} slot={slot} uid={`tile-${g.id}`} />
                        </span>
                        <span className="flex w-full items-start justify-between gap-2">
                          <span className="text-sm font-semibold">{g.name}</span>
                          {tag && (
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${tag === "Plus" ? "bg-saffron text-saffron-ink" : "bg-basil text-basil-ink"}`}>
                              {tag}
                            </span>
                          )}
                        </span>
                        <span className="text-xs capitalize text-muted">{g.rarity}</span>
                        <span className="text-xs text-muted">
                          {!canWear ? `${lockReason(g)} · ${trying ? "Previewing" : "Tap to preview"}` : on ? "Wearing" : "Tap to wear"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>
      )}

      {tab === "clubs" && (
        <section className="card flex flex-col gap-4 p-6">
          <p className="text-sm text-muted">Pick up to {MAX_CLUBS} clubs to show who you cook as or for.</p>
          <ul className="flex flex-col gap-2">
            {CLUBS.map((c) => {
              const on = clubs.includes(c.id);
              const full = !on && clubs.length >= MAX_CLUBS;
              return (
                <li key={c.id}>
                  <label className={`flex items-start gap-3 rounded-2xl border p-3 ${on ? "border-basil bg-basil/10" : "border-line"} ${full ? "opacity-50" : "cursor-pointer hover:border-basil"}`}>
                    <input type="checkbox" className="mt-1" checked={on} disabled={full} onChange={() => toggleClub(c.id)} />
                    <span>
                      <span className="block text-sm font-semibold">{c.name}</span>
                      <span className="block text-xs text-muted">{c.blurb}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          <div className="flex items-center gap-3">
            <button className="btn btn-primary btn-sm" onClick={saveClubs} disabled={pending || !clubsDirty}>
              Save clubs
            </button>
            <p role="status" className={`text-sm ${clubMsg === "Saved." ? "text-basil" : "text-chili"}`}>{clubMsg}</p>
          </div>
        </section>
      )}

      {tab === "shop" && (
        <section className="flex flex-col gap-6">
          <p className="text-sm text-muted">
            Just for fun: shop gear changes how your chef looks, nothing else. Paid once with Stripe, yours to keep on this account.
          </p>
          <div className="card flex flex-col gap-3 p-6">
            <span className="label">Bundles</span>
            <ul className="grid gap-2 sm:grid-cols-2">
              {BUNDLES.map((b) => {
                const buy = purchasable({ bundle: b.id }, owned);
                if (!buy) return null; // already own everything in it
                return (
                  <li key={b.id} className="flex flex-col gap-2 rounded-2xl border border-saffron p-3">
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold">{b.name}</span>
                      <span className="flex flex-col items-end">
                        <span className="tabular font-mono text-sm">{priceLabel(buy.cents)}</span>
                        {buy.cents < singlesCents(buy.items) && (
                          <span className="tabular text-xs text-muted line-through">{priceLabel(singlesCents(buy.items))}</span>
                        )}
                      </span>
                    </span>
                    <span className="text-xs text-muted">
                      {b.items.map((id) => GEAR_BY_ID[id]?.name).filter(Boolean).join(", ")}
                      {buy.items.length < b.items.length && ` (you get the ${buy.items.length} you don't have)`}
                    </span>
                    <PreviewButton on={preview.join("|") === b.items.join("|")} onClick={() => tryOn(b.items)} />
                    <ShopBuy field="bundle" id={b.id} />
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="card flex flex-col gap-3 p-6">
            <span className="label">Single items</span>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {GEAR.filter((g) => g.source.kind === "shop").map((g) => {
                const have = owned.includes(g.id);
                return (
                  <li key={g.id} className={`flex flex-col gap-1 rounded-2xl border p-3 ${RARITY_BORDER[g.rarity]}`}>
                    <TileChef avatar={wearing(shown, [g])} slot={g.slot} uid={`shop-${g.id}`} />
                    <span className="text-sm font-semibold">{g.name}</span>
                    <span className="text-xs capitalize text-muted">
                      {SLOT_LABELS[g.slot].replace(/s$/, "")} · {g.rarity}
                    </span>
                    {have ? (
                      <span className="text-xs font-semibold text-basil">Owned</span>
                    ) : (
                      <>
                        <span className="tabular font-mono text-sm">{g.source.kind === "shop" && priceLabel(g.source.cents)}</span>
                        <PreviewButton on={preview.length === 1 && preview[0] === g.id} onClick={() => tryOn([g.id])} />
                        <ShopBuy field="item" id={g.id} />
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
          <p className="text-xs text-muted">
            Digital items have no cash value and can&apos;t be transferred. See the{" "}
            <Link href="/terms" className="underline">terms</Link>.
          </p>
        </section>
      )}
    </div>
  );
}

function PreviewButton({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className="btn btn-ghost btn-sm w-full">
      {on ? "End preview" : "Preview on my chef"}
    </button>
  );
}

/** A plain form so checkout works without client JS; the server works out the price. */
function ShopBuy({ field, id }: { field: "item" | "bundle"; id: string }) {
  return (
    <form action="/api/stripe/gear" method="post">
      <input type="hidden" name={field} value={id} />
      <button type="submit" className="btn btn-primary btn-sm w-full">Buy</button>
    </form>
  );
}
