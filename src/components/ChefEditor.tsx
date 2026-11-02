"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveChef, setClubs } from "@/app/chef/actions";
import { ChefAvatar } from "@/components/ChefAvatar";
import { LOOK_NAMES } from "@/components/chef/look";
import { CLUBS, MAX_CLUBS } from "@/lib/clubs";
import {
  GEAR, LOOK_OPTIONS, SLOTS, lockReason,
  type Avatar, type GearItem, type LookPart, type Rarity, type Slot,
} from "@/lib/avatar";

export type ChefTab = "look" | "wardrobe" | "clubs" | "shop";
export const CHEF_TABS: { id: ChefTab; label: string }[] = [
  { id: "look", label: "Look" },
  { id: "wardrobe", label: "Wardrobe" },
  { id: "clubs", label: "Clubs" },
  { id: "shop", label: "Shop" },
];

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

type Props = {
  initial: Avatar;
  unlocked: string[];
  clubs: string[];
  saved: boolean;
  tab: ChefTab;
};

export function ChefEditor({ initial, unlocked, clubs: initialClubs, saved, tab }: Props) {
  const router = useRouter();
  const [avatar, setAvatar] = useState<Avatar>(initial);
  const [base, setBase] = useState<Avatar>(initial);
  const [everSaved, setEverSaved] = useState(saved);
  const [clubs, setClubIds] = useState<string[]>(initialClubs);
  const [clubBase, setClubBase] = useState<string[]>(initialClubs);
  const [msg, setMsg] = useState("");
  const [clubMsg, setClubMsg] = useState("");
  const [pending, start] = useTransition();
  const open = new Set(unlocked);

  const dirty = JSON.stringify(avatar) !== JSON.stringify(base) || !everSaved;
  const clubsDirty = clubs.join("|") !== clubBase.join("|");

  const setLook = (part: LookPart, i: number) => setAvatar((a) => ({ ...a, look: { ...a.look, [part]: i } }));
  const equip = (g: GearItem) => setAvatar((a) => ({ ...a, equipped: { ...a.equipped, [g.slot]: g.id } }));

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
      <div className="card flex flex-col items-center gap-3 p-6">
        <ChefAvatar avatar={avatar} size={260} uid="editor" title="Your chef" />
        {!everSaved && (
          <p className="text-sm text-muted">This chef was picked for you. Make it yours, then save.</p>
        )}
        <div className="flex flex-col items-center gap-1">
          <button className="btn btn-primary" onClick={save} disabled={pending || !dirty}>
            {pending ? "Saving..." : everSaved ? "Save chef" : "Save my chef"}
          </button>
          <p role="status" className={`min-h-5 text-sm ${msg === "Saved." ? "text-basil" : "text-chili"}`}>{msg}</p>
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
                {GEAR.filter((g) => g.slot === slot).map((g) => {
                  const isOpen = open.has(g.id);
                  const on = avatar.equipped[slot] === g.id;
                  const tag = g.source.kind === "shop" ? "Shop" : g.source.kind === "plus" ? "Plus" : null;
                  return (
                    <li key={g.id}>
                      <button
                        type="button"
                        disabled={!isOpen}
                        aria-pressed={on}
                        onClick={() => equip(g)}
                        className={`flex h-full w-full flex-col items-start gap-1 rounded-2xl border p-3 text-left ${RARITY_BORDER[g.rarity]} ${on ? "bg-basil/10 ring-2 ring-basil" : ""} ${isOpen ? "hover:bg-sunk" : "opacity-50"}`}
                      >
                        <span className="flex w-full items-start justify-between gap-2">
                          <span className="text-sm font-semibold">{g.name}</span>
                          {tag && (
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${tag === "Plus" ? "bg-saffron text-saffron-ink" : "bg-basil text-basil-ink"}`}>
                              {tag}
                            </span>
                          )}
                        </span>
                        <span className="text-xs capitalize text-muted">{g.rarity}</span>
                        <span className="text-xs text-muted">{on ? "Wearing" : isOpen ? "Tap to wear" : lockReason(g)}</span>
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
        <section className="card p-6 text-center">
          <p className="font-display text-xl font-bold">Coming soon</p>
          <p className="text-sm text-muted">Extra gear and bundles are on the way.</p>
        </section>
      )}
    </div>
  );
}
