import { test } from "node:test";
import assert from "node:assert/strict";
import { LEVELS } from "./game.ts";
import {
  BUNDLES, GEAR, GEAR_BY_ID, singlesCents, LOOK_OPTIONS, SLOTS, canSave, cleanAvatar, defaultAvatar, lockReason, newUnlocks, parseAvatar,
  gearMetadata, parseGearMetadata, priceLabel, purchasable, starterFor, unlockedGear, visibleAvatar,
} from "./avatar.ts";

const SHOP_ITEM = "pizza-slice";
const PLUS_HAT = "velvet-toque";
const LEVEL_HAT_2 = "sous-toque";

test("catalog rules", () => {
  const ids = GEAR.map((g) => g.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const s of SLOTS) assert.equal(GEAR.filter((g) => g.slot === s && g.source.kind === "starter").length, 1);
  for (const g of GEAR.filter((g) => g.rarity === "legendary")) assert.ok(["level", "badge"].includes(g.source.kind), g.id);
  for (const g of GEAR) if (g.source.kind === "shop") assert.ok(g.source.cents >= 199, g.id);
  LEVELS.forEach((_, i) => assert.ok(GEAR.some((g) => g.slot === "hat" && g.source.kind === "level" && g.source.level === i)));
  for (const b of BUNDLES) {
    assert.ok(b.cents >= 399 && b.cents <= 999);
    assert.ok(b.cents < singlesCents(b.items), `${b.id} should cost less than its items`);
    for (const id of b.items) assert.equal(GEAR_BY_ID[id]?.source.kind, "shop", id);
  }
  for (const g of GEAR.filter((g) => g.source.kind === "shop" || g.source.kind === "plus")) assert.notEqual(g.rarity, "legendary", g.id);
  assert.equal(GEAR_BY_ID[SHOP_ITEM]?.source.kind, "shop");
  assert.equal(GEAR_BY_ID[PLUS_HAT]?.source.kind, "plus");
  assert.equal(GEAR_BY_ID[PLUS_HAT]?.slot, "hat");
  assert.equal(GEAR_BY_ID[LEVEL_HAT_2]?.source.kind, "level");
});

test("unlocks follow points, badges, Plus and purchases", () => {
  const none = unlockedGear({ points: 0, badges: [], plus: false, owned: [], bingo: { lines: 0, full: 0 } });
  assert.ok(GEAR.filter((g) => g.source.kind === "starter").every((g) => none.has(g.id)));
  assert.ok(!GEAR.some((g) => g.source.kind === "plus" && none.has(g.id)));
  const sous = unlockedGear({ points: 300, badges: ["crowd_favorite"], plus: true, owned: [SHOP_ITEM], bingo: { lines: 0, full: 0 } });
  const levelHat = (n: number) => GEAR.find((g) => g.source.kind === "level" && g.source.level === n)!.id;
  assert.ok([0, 1, 2].every((n) => sous.has(levelHat(n))));
  assert.ok(!sous.has(levelHat(3)));
  assert.ok(sous.has(GEAR.find((g) => g.source.kind === "badge" && g.source.badge === "crowd_favorite")!.id));
  assert.ok(GEAR.filter((g) => g.source.kind === "plus").every((g) => sous.has(g.id)));
  assert.ok(sous.has(SHOP_ITEM));
  assert.ok(!none.has(SHOP_ITEM));
});

test("points milestones unlock at the threshold", () => {
  const item = GEAR.find((g) => g.source.kind === "points" && g.source.at === 250)!;
  assert.ok(!unlockedGear({ points: 249, badges: [], plus: false, owned: [], bingo: { lines: 0, full: 0 } }).has(item.id));
  assert.ok(unlockedGear({ points: 250, badges: [], plus: false, owned: [], bingo: { lines: 0, full: 0 } }).has(item.id));
});

test("saving rejects locked or unknown gear and wrong slots", () => {
  const free = unlockedGear({ points: 0, badges: [], plus: false, owned: [], bingo: { lines: 0, full: 0 } });
  const base = defaultAvatar("u1");
  assert.equal(canSave(base, free).ok, true);
  assert.equal(canSave({ ...base, equipped: { ...base.equipped, hat: PLUS_HAT } }, free).ok, false);
  assert.equal(canSave({ ...base, equipped: { hat: "no-such-item" } }, free).ok, false);
  assert.equal(canSave({ ...base, equipped: { outfit: starterFor("hat").id } }, free).ok, false);
  assert.equal(canSave({ ...base, look: { ...base.look, skin: 8 } }, free).ok, false);
  assert.equal(canSave({ ...base, look: { ...base.look, skin: -1 } }, free).ok, false);
});

test("Plus gear hides when Plus ends and the choice is kept", () => {
  const a = { look: defaultAvatar("u1").look, equipped: { hat: PLUS_HAT } };
  assert.equal(visibleAvatar(a, false).equipped.hat, starterFor("hat").id);
  assert.equal(visibleAvatar(a, true).equipped.hat, PLUS_HAT);
  assert.equal(a.equipped.hat, PLUS_HAT); // not mutated
  assert.equal(visibleAvatar({ look: a.look, equipped: {} }, false).equipped.hat, undefined);
});

test("bad saved JSON falls back per field and never throws", () => {
  assert.deepEqual(parseAvatar(null, "u1"), defaultAvatar("u1"));
  assert.deepEqual(parseAvatar("junk", "u1"), defaultAvatar("u1"));
  const p = parseAvatar({ look: { skin: 99, eyes: 2 }, equipped: { hat: "gone", tool: starterFor("tool").id } }, "u1");
  assert.equal(p.look.eyes, 2);
  assert.equal(p.look.skin, defaultAvatar("u1").look.skin);
  assert.equal(p.equipped.hat, undefined);
  assert.equal(p.equipped.tool, starterFor("tool").id);
  assert.equal(parseAvatar({ equipped: { outfit: starterFor("hat").id } }, "u1").equipped.outfit, undefined);
});

test("default avatar is steady per user and wears starter gear", () => {
  assert.deepEqual(defaultAvatar("abc"), defaultAvatar("abc"));
  assert.notDeepEqual(defaultAvatar("abc").look, defaultAvatar("xyz").look);
  for (const s of ["hat", "outfit", "tool", "background"] as const) assert.equal(defaultAvatar("abc").equipped[s], starterFor(s).id);
  // Frames and sayings are extras: a new chef starts without them.
  assert.equal(defaultAvatar("abc").equipped.frame, undefined);
  assert.equal(defaultAvatar("abc").equipped.saying, undefined);
});

test("Plus frames and sayings come off when Plus ends; other Plus gear drops to the starter", () => {
  const a = { ...defaultAvatar("u1"), equipped: { hat: "velvet-toque", frame: "velvet-frame", saying: "secret-menu" } };
  const seen = visibleAvatar(a, false).equipped;
  assert.equal(seen.hat, starterFor("hat").id);
  assert.equal(seen.frame, undefined);
  assert.equal(seen.saying, undefined);
  assert.deepEqual(visibleAvatar(a, true).equipped, a.equipped);
});

test("most default chefs have no facial hair or glasses; other parts spread out", () => {
  const looks = Array.from({ length: 200 }, (_, i) => defaultAvatar(`synthetic-user-${i}`).look);
  assert.deepEqual(defaultAvatar("synthetic-user-7"), defaultAvatar("synthetic-user-7"));
  const share = (f: (l: (typeof looks)[number]) => boolean) => looks.filter(f).length / looks.length;
  assert.ok(share((l) => l.facialHair === 0) >= 0.6);
  assert.ok(share((l) => l.glasses === 0) >= 0.6);
  // Every non-none extra still shows up, and every skin tone and hair style is used.
  for (let i = 1; i < LOOK_OPTIONS.facialHair; i++) assert.ok(looks.some((l) => l.facialHair === i));
  for (let i = 1; i < LOOK_OPTIONS.glasses; i++) assert.ok(looks.some((l) => l.glasses === i));
  for (let i = 0; i < LOOK_OPTIONS.skin; i++) assert.ok(looks.some((l) => l.skin === i));
  for (let i = 0; i < LOOK_OPTIONS.hair; i++) assert.ok(looks.some((l) => l.hair === i));
});

test("buying: owned items and fully owned bundles can't be bought", () => {
  assert.equal(purchasable({ item: SHOP_ITEM }, [SHOP_ITEM]), null);
  assert.equal(purchasable({ item: PLUS_HAT }, []), null); // not a shop item
  assert.equal(purchasable({ item: SHOP_ITEM }, [])?.cents, 199);
  const b = BUNDLES[0];
  assert.equal(purchasable({ bundle: b.id }, b.items), null);
  assert.deepEqual(purchasable({ bundle: b.id }, [b.items[0]])?.items, b.items.slice(1));
  assert.equal(purchasable({ bundle: b.id }, [b.items[0]])?.cents, Math.min(b.cents, singlesCents(b.items.slice(1))));
  // Owning all but one item of the whole shop costs that one item's price, not $9.99.
  const all = BUNDLES.find((x) => x.id === "whole-shop")!;
  assert.equal(all.items.length, GEAR.filter((g) => g.source.kind === "shop").length);
  assert.equal(purchasable({ bundle: all.id }, all.items.slice(1))?.cents, 199);
  assert.equal(purchasable({ bundle: "nope" }, []), null);
});

test("labels", () => {
  assert.equal(priceLabel(199), "$1.99");
  assert.equal(lockReason(GEAR_BY_ID[LEVEL_HAT_2]), "Reach Sous chef");
  assert.equal(lockReason(GEAR_BY_ID[PLUS_HAT]), "Plus");
  assert.equal(lockReason(GEAR_BY_ID[SHOP_ITEM]), "$1.99");
  assert.equal(newUnlocks(new Set([starterFor("hat").id, "x"]), []).includes(starterFor("hat").id), false);
  assert.deepEqual(newUnlocks(new Set([starterFor("hat").id, LEVEL_HAT_2]), [LEVEL_HAT_2]), []);
  assert.deepEqual(newUnlocks(new Set([LEVEL_HAT_2]), []), [LEVEL_HAT_2]);
});

test("prototype keys from untrusted input are ignored", () => {
  assert.equal(purchasable({ item: "constructor" }, []), null);
  assert.equal(purchasable({ bundle: "toString" }, []), null);
  assert.doesNotThrow(() => unlockedGear({ points: 0, badges: [], plus: false, owned: ["constructor", "__proto__"], bingo: { lines: 0, full: 0 } }));
  assert.equal(parseAvatar({ equipped: { hat: "__proto__" } }, "u1").equipped.hat, undefined);
  assert.equal(canSave({ ...defaultAvatar("u1"), equipped: { hat: "constructor" } }, new Set()).ok, false);
  assert.doesNotThrow(() => visibleAvatar({ look: defaultAvatar("u1").look, equipped: { hat: "toString" } }, false));
});

test("lapsed Plus keeps an unchanged saved Plus item but cannot pick new locked gear", () => {
  const free = unlockedGear({ points: 0, badges: [], plus: false, owned: [], bingo: { lines: 0, full: 0 } });
  const base = defaultAvatar("u1");
  const saved = { ...base, equipped: { ...base.equipped, hat: PLUS_HAT } };
  const edited = { ...saved, look: { ...saved.look, hair: (saved.look.hair + 1) % LOOK_OPTIONS.hair } };
  assert.equal(canSave(edited, free, saved).ok, true);
  assert.equal(canSave(edited, free).ok, false);
  assert.equal(canSave({ ...edited, equipped: { ...edited.equipped, hat: LEVEL_HAT_2 } }, free, saved).ok, false);
  assert.equal(canSave({ ...edited, equipped: { ...edited.equipped, outfit: "no-such-item" } }, free, saved).ok, false);
});

test("canSave returns not-ok for malformed avatars instead of throwing", () => {
  const free = unlockedGear({ points: 0, badges: [], plus: false, owned: [], bingo: { lines: 0, full: 0 } });
  for (const bad of [null, undefined, 5, "x", {}, { look: null }, { look: {}, equipped: 3 }]) {
    assert.equal(canSave(bad as never, free).ok, false);
  }
});

test("purchase metadata round-trips known shop ids only", () => {
  assert.deepEqual(parseGearMetadata(gearMetadata([SHOP_ITEM, "nope", PLUS_HAT])), [SHOP_ITEM]);
  assert.deepEqual(parseGearMetadata(null), []);
  assert.deepEqual(parseGearMetadata(undefined), []);
  assert.deepEqual(parseGearMetadata(""), []);
  assert.deepEqual(parseGearMetadata(" pizza-slice , cat-ears,pizza-slice,constructor"), [SHOP_ITEM, "cat-ears"]);
  assert.equal(gearMetadata(BUNDLES[1].items), BUNDLES[1].items.join(","));
});

test("cleanAvatar keeps only known look parts and slots", () => {
  const base = defaultAvatar("u1");
  const dirty = {
    look: { ...base.look, evil: "x", __proto__x: 1 },
    equipped: { ...base.equipped, cape: "pizza-slice", extra: { deep: true } },
    note: "drop me",
  } as never as Parameters<typeof cleanAvatar>[0];
  const clean = cleanAvatar(dirty);
  assert.deepEqual(Object.keys(clean).sort(), ["equipped", "look"]);
  assert.deepEqual(Object.keys(clean.look).sort(), Object.keys(LOOK_OPTIONS).sort());
  assert.deepEqual(clean.look, base.look);
  assert.deepEqual(clean.equipped, base.equipped);
  assert.deepEqual(cleanAvatar({ look: base.look, equipped: { hat: "paper-hat" } }).equipped, { hat: "paper-hat" });
});

test("any slot can be empty", () => {
  const free = unlockedGear({ points: 0, badges: [], plus: false, owned: [], bingo: { lines: 0, full: 0 } });
  const base = defaultAvatar("u1");
  assert.equal(canSave({ ...base, equipped: {} }, free).ok, true);
  for (const s of SLOTS) {
    const equipped = { ...base.equipped };
    delete equipped[s];
    assert.equal(canSave({ ...base, equipped }, free).ok, true);
  }
});

test("gear everyone has at zero progress is never a new unlock", () => {
  const fresh = unlockedGear({ points: 0, badges: [], plus: false, owned: [], bingo: { lines: 0, full: 0 } });
  assert.equal(fresh.has("bandana"), true);
  assert.deepEqual(newUnlocks(fresh, []), []);
  const level1 = unlockedGear({ points: LEVELS[1].min, badges: [], plus: false, owned: [], bingo: { lines: 0, full: 0 } });
  assert.deepEqual(newUnlocks(level1, []), ["prep-cap", "let-me-cook"]);
});

test("Bingo gear unlocks from lifetime lines and full cards", () => {
  const ctx = (lines: number, full: number) => unlockedGear({ points: 0, badges: [], plus: false, owned: [], bingo: { lines, full } });
  assert.ok(!ctx(0, 0).has("called-it"));
  assert.ok(ctx(1, 0).has("called-it"));
  assert.ok(!ctx(4, 0).has("bingo-balls"));
  assert.ok(ctx(5, 0).has("bingo-balls"));
  assert.ok(!ctx(8, 0).has("full-house"));
  assert.ok(ctx(8, 1).has("full-house"));
  assert.equal(lockReason(GEAR_BY_ID["bingo-balls"]), "Get 5 Bingo lines");
  assert.equal(lockReason(GEAR_BY_ID["full-house"]), "Fill a Bingo card");
});
