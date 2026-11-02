// Chef avatar rules: gear catalog, unlocks, validation, shop pricing. Pure functions,
// shared by server and client; covered by avatar.test.ts. Tune the catalog here.

import type { BadgeId } from "./database.types.ts";
import { BADGES, LEVELS, levelFor } from "./game.ts";

export type Slot = "hat" | "outfit" | "tool" | "background";
export const SLOTS: Slot[] = ["hat", "outfit", "tool", "background"];
export type Rarity = "common" | "rare" | "epic" | "legendary";

export type GearSource =
  | { kind: "starter" }
  | { kind: "level"; level: number } // index into LEVELS
  | { kind: "points"; at: number } // lifetime points milestone
  | { kind: "badge"; badge: BadgeId }
  | { kind: "plus" }
  | { kind: "shop"; cents: number };

export type GearItem = { id: string; slot: Slot; name: string; rarity: Rarity; source: GearSource };
export type Bundle = { id: string; name: string; cents: number; items: string[] };

const SHOP = 199;
const gear = (id: string, slot: Slot, name: string, rarity: Rarity, source: GearSource): GearItem => ({ id, slot, name, rarity, source });

export const GEAR: GearItem[] = [
  // Starters: everyone has these.
  gear("paper-hat", "hat", "Paper hat", "common", { kind: "starter" }),
  gear("plain-apron", "outfit", "Plain apron", "common", { kind: "starter" }),
  gear("wooden-spoon", "tool", "Wooden spoon", "common", { kind: "starter" }),
  gear("kitchen-tile", "background", "Kitchen tile", "common", { kind: "starter" }),

  // Level hats, one per level.
  gear("bandana", "hat", "Bandana", "common", { kind: "level", level: 0 }),
  gear("prep-cap", "hat", "Prep cap", "common", { kind: "level", level: 1 }),
  gear("sous-toque", "hat", "Sous toque", "rare", { kind: "level", level: 2 }),
  gear("tall-toque", "hat", "Tall toque", "epic", { kind: "level", level: 3 }),
  gear("golden-toque", "hat", "Golden toque", "legendary", { kind: "level", level: 4 }),

  // Lifetime points milestones.
  gear("balloon-whisk", "tool", "Balloon whisk", "common", { kind: "points", at: 250 }),
  gear("chef-whites", "outfit", "Chef whites", "rare", { kind: "points", at: 500 }),
  gear("busy-line", "background", "Busy line", "epic", { kind: "points", at: 1000 }),
  gear("copper-pan", "tool", "Copper pan", "epic", { kind: "points", at: 2500 }),

  // Badges, themed on what was done.
  gear("winners-jacket", "outfit", "Winner's jacket", "legendary", { kind: "badge", badge: "crowd_favorite" }),
  gear("spotlight", "background", "Spotlight", "legendary", { kind: "badge", badge: "chef_pick" }),
  gear("piggy-bank", "tool", "Piggy bank", "rare", { kind: "badge", badge: "thriftiest" }),
  gear("hot-streak-apron", "outfit", "Hot streak apron", "rare", { kind: "badge", badge: "streak_4" }),
  gear("coin-jar", "tool", "Coin jar", "common", { kind: "badge", badge: "saved_100" }),
  gear("money-apron", "outfit", "Money apron", "epic", { kind: "badge", badge: "saved_1000" }),
  gear("dinner-party", "background", "Dinner party", "rare", { kind: "badge", badge: "brought_3" }),

  // Plus.
  gear("velvet-toque", "hat", "Velvet toque", "epic", { kind: "plus" }),
  gear("silk-beret", "hat", "Silk beret", "rare", { kind: "plus" }),
  gear("midnight-whites", "outfit", "Midnight whites", "epic", { kind: "plus" }),
  gear("silver-ladle", "tool", "Silver ladle", "rare", { kind: "plus" }),
  gear("carbon-knife", "tool", "Carbon knife", "epic", { kind: "plus" }),
  gear("marble-counter", "background", "Marble counter", "rare", { kind: "plus" }),

  // Shop: fun and style.
  gear("pizza-slice", "hat", "Pizza slice", "common", { kind: "shop", cents: SHOP }),
  gear("cat-ears", "hat", "Cat ears", "rare", { kind: "shop", cents: SHOP }),
  gear("hawaiian-shirt", "outfit", "Hawaiian shirt", "common", { kind: "shop", cents: SHOP }),
  gear("tuxedo", "outfit", "Tuxedo", "rare", { kind: "shop", cents: SHOP }),
  gear("pj-set", "outfit", "Pajamas", "common", { kind: "shop", cents: SHOP }),
  gear("rubber-chicken", "tool", "Rubber chicken", "common", { kind: "shop", cents: SHOP }),
  gear("giant-fork", "tool", "Giant fork", "rare", { kind: "shop", cents: SHOP }),
  gear("flame-torch", "tool", "Flame torch", "epic", { kind: "shop", cents: SHOP }),
  gear("beach-day", "background", "Beach day", "common", { kind: "shop", cents: SHOP }),
  gear("disco-floor", "background", "Disco floor", "epic", { kind: "shop", cents: SHOP }),
];

export const GEAR_BY_ID: Record<string, GearItem> = Object.fromEntries(GEAR.map((g) => [g.id, g]));

export const BUNDLES: Bundle[] = [
  { id: "party-night", name: "Party night", cents: 399, items: ["disco-floor", "tuxedo", "cat-ears"] },
  { id: "backyard-bbq", name: "Backyard BBQ", cents: 499, items: ["hawaiian-shirt", "beach-day", "giant-fork", "flame-torch"] },
];

export type LookPart = "skin" | "eyes" | "brows" | "mouth" | "hair" | "hairColor" | "facialHair" | "glasses";
export type Look = Record<LookPart, number>; // option indices
export const LOOK_OPTIONS: Record<LookPart, number> = { skin: 8, eyes: 6, brows: 4, mouth: 6, hair: 10, hairColor: 8, facialHair: 4, glasses: 4 };
const LOOK_PARTS = Object.keys(LOOK_OPTIONS) as LookPart[];

export type Avatar = { look: Look; equipped: Partial<Record<Slot, string>> };
export type GearContext = { points: number; badges: BadgeId[]; plus: boolean; owned: string[] };

export function starterFor(slot: Slot): GearItem {
  return GEAR.find((g) => g.slot === slot && g.source.kind === "starter")!;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const validIndex = (part: LookPart, v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= 0 && v < LOOK_OPTIONS[part];

export function defaultAvatar(userId: string): Avatar {
  const look = {} as Look;
  for (const p of LOOK_PARTS) look[p] = hash(`${p}:${userId}`) % LOOK_OPTIONS[p];
  const equipped: Avatar["equipped"] = {};
  for (const s of SLOTS) equipped[s] = starterFor(s).id;
  return { look, equipped };
}

/** Reads a saved avatar from untrusted JSON. Bad fields fall back to the default's; never throws. */
export function parseAvatar(json: unknown, userId: string): Avatar {
  const def = defaultAvatar(userId);
  if (!json || typeof json !== "object") return def;
  const { look, equipped } = json as { look?: unknown; equipped?: unknown };
  const out: Avatar = { look: { ...def.look }, equipped: {} };
  if (look && typeof look === "object") {
    for (const p of LOOK_PARTS) {
      const v = (look as Record<string, unknown>)[p];
      if (validIndex(p, v)) out.look[p] = v;
    }
  }
  if (equipped && typeof equipped === "object") {
    for (const s of SLOTS) {
      const id = (equipped as Record<string, unknown>)[s];
      if (typeof id === "string" && GEAR_BY_ID[id]?.slot === s) out.equipped[s] = id;
    }
  }
  return out;
}

export function unlockedGear(ctx: GearContext): Set<string> {
  const level = levelFor(ctx.points).index;
  const out = new Set<string>();
  for (const g of GEAR) {
    const s = g.source;
    if (
      s.kind === "starter" ||
      (s.kind === "level" && level >= s.level) ||
      (s.kind === "points" && ctx.points >= s.at) ||
      (s.kind === "badge" && ctx.badges.includes(s.badge)) ||
      (s.kind === "plus" && ctx.plus)
    ) out.add(g.id);
  }
  for (const id of ctx.owned) if (GEAR_BY_ID[id]?.source.kind === "shop") out.add(id);
  return out;
}

export function canSave(avatar: Avatar, unlocked: Set<string>): { ok: true } | { ok: false; message: string } {
  for (const p of LOOK_PARTS) {
    if (!validIndex(p, avatar.look?.[p])) return { ok: false, message: "That look isn't available." };
  }
  for (const [slot, id] of Object.entries(avatar.equipped ?? {})) {
    if (id === undefined) continue;
    const g = GEAR_BY_ID[id];
    if (!g || g.slot !== slot) return { ok: false, message: "That gear doesn't exist." };
    if (!unlocked.has(id)) return { ok: false, message: "That gear is locked." };
  }
  return { ok: true };
}

/** What others see: Plus gear drops back to the starter when Plus ends (the saved choice is kept). */
export function visibleAvatar(avatar: Avatar, plus: boolean): Avatar {
  if (plus) return avatar;
  const equipped: Avatar["equipped"] = {};
  for (const s of SLOTS) {
    const id = avatar.equipped[s];
    if (id === undefined) continue;
    equipped[s] = GEAR_BY_ID[id]?.source.kind === "plus" ? starterFor(s).id : id;
  }
  return { ...avatar, equipped };
}

/** Unlocked gear not yet seen, excluding starters, in catalog order. */
export function newUnlocks(unlocked: Set<string>, seen: string[]): string[] {
  const seenSet = new Set(seen);
  return GEAR.filter((g) => g.source.kind !== "starter" && unlocked.has(g.id) && !seenSet.has(g.id)).map((g) => g.id);
}

export function priceLabel(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function lockReason(item: GearItem): string {
  const s = item.source;
  switch (s.kind) {
    case "starter": return "Starter";
    case "level": return `Reach ${LEVELS[s.level].name}`;
    case "points": return `Earn ${s.at} points`;
    case "badge": return `Earn the ${BADGES[s.badge].label} badge`;
    case "plus": return "Plus";
    case "shop": return priceLabel(s.cents);
  }
}

/** What buying a shop item or bundle would add and cost, or null if there is nothing to buy. */
export function purchasable(
  target: { item: string } | { bundle: string },
  owned: string[],
): { items: string[]; cents: number; name: string } | null {
  if ("item" in target) {
    const g = GEAR_BY_ID[target.item];
    if (!g || g.source.kind !== "shop" || owned.includes(g.id)) return null;
    return { items: [g.id], cents: g.source.cents, name: g.name };
  }
  const b = BUNDLES.find((x) => x.id === target.bundle);
  if (!b) return null;
  const items = b.items.filter((id) => !owned.includes(id));
  return items.length ? { items, cents: b.cents, name: b.name } : null;
}
