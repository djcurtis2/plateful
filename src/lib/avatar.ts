// Chef avatar rules: gear catalog, unlocks, validation, shop pricing. Pure functions,
// shared by server and client; covered by avatar.test.ts. Tune the catalog here.

import type { BadgeId } from "./database.types.ts";
import { BADGES, LEVELS, levelFor } from "./game.ts";

export type Slot = "hat" | "outfit" | "tool" | "background" | "frame" | "saying";
export const SLOTS: Slot[] = ["hat", "outfit", "tool", "background", "frame", "saying"];
/** Extras a new chef starts without (their starters are there to pick, not worn by default). */
const OPTIONAL_SLOTS: Slot[] = ["frame", "saying"];
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

  // Frames: a border around the chef (around the head in small pictures).
  gear("simple-frame", "frame", "Simple frame", "common", { kind: "starter" }),
  gear("herb-wreath", "frame", "Herb wreath", "common", { kind: "points", at: 250 }),
  gear("flame-frame", "frame", "Flame frame", "rare", { kind: "badge", badge: "streak_4" }),
  gear("gold-frame", "frame", "Gold frame", "epic", { kind: "level", level: 3 }),
  gear("champion-laurel", "frame", "Champion laurel", "legendary", { kind: "badge", badge: "top10" }),
  gear("velvet-frame", "frame", "Velvet frame", "rare", { kind: "plus" }),
  gear("sprinkle-frame", "frame", "Sprinkles", "common", { kind: "shop", cents: SHOP }),
  gear("pixel-frame", "frame", "Pixel frame", "rare", { kind: "shop", cents: SHOP }),

  // Sayings: a patch on the chef's front. A fixed list (nobody types their own), most of them earned.
  gear("yes-chef", "saying", "Yes, chef!", "common", { kind: "starter" }),
  gear("let-me-cook", "saying", "Let me cook", "common", { kind: "level", level: 1 }),
  gear("sauce-boss", "saying", "Sauce boss", "common", { kind: "points", at: 250 }),
  gear("copycat-champ", "saying", "Copycat champ", "rare", { kind: "badge", badge: "first_copycat" }),
  gear("beat-the-menu", "saying", "Beat the menu", "rare", { kind: "badge", badge: "saved_100" }),
  gear("hot-streak", "saying", "On a hot streak", "rare", { kind: "badge", badge: "streak_4" }),
  gear("penny-pincher", "saying", "Penny pincher", "epic", { kind: "badge", badge: "thriftiest" }),
  gear("head-chef", "saying", "Head chef", "epic", { kind: "level", level: 3 }),
  gear("crowd-fave", "saying", "Crowd fave", "legendary", { kind: "badge", badge: "crowd_favorite" }),
  gear("secret-menu", "saying", "Secret menu", "rare", { kind: "plus" }),
];

// Null prototype so untrusted ids like "constructor" or "__proto__" never resolve to inherited members.
export const GEAR_BY_ID: Record<string, GearItem> = Object.assign(Object.create(null), Object.fromEntries(GEAR.map((g) => [g.id, g])));

export const BUNDLES: Bundle[] = [
  { id: "party-night", name: "Party night", cents: 399, items: ["disco-floor", "tuxedo", "cat-ears"] },
  { id: "backyard-bbq", name: "Backyard BBQ", cents: 499, items: ["hawaiian-shirt", "beach-day", "giant-fork", "flame-torch"] },
  { id: "pajama-party", name: "Pajama party", cents: 399, items: ["pj-set", "pizza-slice", "rubber-chicken"] },
  // Everything in the shop at about half the single-item price.
  { id: "whole-shop", name: "The whole shop", cents: 999, items: GEAR.filter((g) => g.source.kind === "shop").map((g) => g.id) },
];

/** What the items would cost bought one at a time. */
export function singlesCents(items: string[]): number {
  return items.reduce((sum, id) => {
    const g = GEAR_BY_ID[id];
    return sum + (g?.source.kind === "shop" ? g.source.cents : 0);
  }, 0);
}

export type LookPart = "skin" | "eyes" | "brows" | "mouth" | "hair" | "hairColor" | "facialHair" | "glasses";
export type Look = Record<LookPart, number>; // option indices
export const LOOK_OPTIONS: Record<LookPart, number> = { skin: 8, eyes: 6, brows: 4, mouth: 6, hair: 10, hairColor: 8, facialHair: 4, glasses: 4 };
export const LOOK_PARTS = Object.keys(LOOK_OPTIONS) as LookPart[];

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

/** Percent of default chefs with option 0 ("none") for the optional extras. */
const NONE_SHARE = { facialHair: 75, glasses: 75 };

export function defaultAvatar(userId: string): Avatar {
  const look = {} as Look;
  for (const p of LOOK_PARTS) {
    const h = hash(`${p}:${userId}`);
    // Facial hair and glasses are extras: most new chefs start without them (option 0 = none).
    look[p] = p in NONE_SHARE
      ? (h % 100 < NONE_SHARE[p as "facialHair" | "glasses"] ? 0 : 1 + (Math.floor(h / 100) % (LOOK_OPTIONS[p] - 1)))
      : h % LOOK_OPTIONS[p];
  }
  const equipped: Avatar["equipped"] = {};
  for (const s of SLOTS) if (!OPTIONAL_SLOTS.includes(s)) equipped[s] = starterFor(s).id;
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

/** Only the known shape: look parts and slots, nothing else the client sent. Run after canSave. */
export function cleanAvatar(avatar: Avatar): Avatar {
  const look = {} as Look;
  for (const p of LOOK_PARTS) look[p] = avatar.look[p];
  const equipped: Avatar["equipped"] = {};
  for (const s of SLOTS) {
    const id = avatar.equipped?.[s];
    if (typeof id === "string") equipped[s] = id;
  }
  return { look, equipped };
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

/** `saved`: the currently saved avatar. Gear unchanged from it stays allowed even if no longer unlocked (e.g. lapsed Plus). */
export function canSave(avatar: Avatar, unlocked: Set<string>, saved?: Avatar): { ok: true } | { ok: false; message: string } {
  if (!avatar || typeof avatar !== "object" || !avatar.look || typeof avatar.look !== "object" || (avatar.equipped != null && typeof avatar.equipped !== "object")) {
    return { ok: false, message: "That look isn't available." };
  }
  for (const p of LOOK_PARTS) {
    if (!validIndex(p, avatar.look?.[p])) return { ok: false, message: "That look isn't available." };
  }
  for (const [slot, id] of Object.entries(avatar.equipped ?? {})) {
    if (id === undefined) continue;
    const g = GEAR_BY_ID[id];
    if (!g || g.slot !== slot) return { ok: false, message: "That gear doesn't exist." };
    if (!unlocked.has(id) && saved?.equipped?.[slot as Slot] !== id) return { ok: false, message: "That gear is locked." };
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
    if (GEAR_BY_ID[id]?.source.kind !== "plus") equipped[s] = id;
    else if (!OPTIONAL_SLOTS.includes(s)) equipped[s] = starterFor(s).id; // extras just come off
  }
  return { ...avatar, equipped };
}

/** Gear everyone has from day one (starters, plus anything unlocked at level 0 or 0 points). Never "new". */
export function unlockedFromStart(item: GearItem): boolean {
  const s = item.source;
  return s.kind === "starter" || (s.kind === "level" && LEVELS[s.level]?.min === 0) || (s.kind === "points" && s.at <= 0);
}

/** Unlocked gear not yet seen, excluding what everyone starts with, in catalog order. */
export function newUnlocks(unlocked: Set<string>, seen: string[]): string[] {
  const seenSet = new Set(seen);
  return GEAR.filter((g) => !unlockedFromStart(g) && unlocked.has(g.id) && !seenSet.has(g.id)).map((g) => g.id);
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
  // Owning part of a bundle never makes the rest cost more than buying it item by item.
  return items.length ? { items, cents: Math.min(b.cents, singlesCents(items)), name: b.name } : null;
}

/** Item ids for Stripe Checkout metadata ("id1,id2"). Stripe caps a metadata value at 500 characters. */
export function gearMetadata(items: string[]): string {
  return items.join(",");
}

/** Reads purchase metadata back. Only known shop items survive, each once; never throws. */
export function parseGearMetadata(s: string | null | undefined): string[] {
  if (typeof s !== "string") return [];
  const out: string[] = [];
  for (const raw of s.split(",")) {
    const id = raw.trim();
    if (GEAR_BY_ID[id]?.source.kind === "shop" && !out.includes(id)) out.push(id);
  }
  return out;
}

/** Tabs on the My chef page. Lives here (not in the client editor) so the server page can read it. */
export type ChefTab = "look" | "wardrobe" | "clubs" | "shop";
export const CHEF_TABS: { id: ChefTab; label: string }[] = [
  { id: "look", label: "Look" },
  { id: "wardrobe", label: "Wardrobe" },
  { id: "clubs", label: "Clubs" },
  { id: "shop", label: "Shop" },
];
