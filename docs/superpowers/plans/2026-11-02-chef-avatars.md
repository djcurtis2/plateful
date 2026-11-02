# Chef Avatars, Gear and Clubs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every signed-in cook gets a designable cartoon chef with gear slots, gear that unlocks from play, Plus and a live Stripe shop, celebrated unlocks, club badges, and club recipe pages.

**Architecture:** One pure catalog-and-rules module (`src/lib/avatar.ts`, plus `src/lib/clubs.ts`) decides what exists, what a person has unlocked, and what may be shown. Earned and Plus gear are derived on the fly from points, badges and plan; only purchases and admin grants are stored (`user_gear`). Avatars are layered inline SVG drawn by one component from the saved `profiles.avatar` JSON, so boards add no image requests.

**Tech Stack:** Next.js 16.4 App Router, React 19, Tailwind 4, Supabase (Postgres + RLS), Stripe Checkout, zod 4, `node --test` with `--experimental-strip-types`.

**Spec:** `docs/superpowers/specs/2026-11-02-chef-avatars-design.md`

## Global Constraints

- Read `CLAUDE.md` first. Run `npm run typecheck` and `npm test` before every commit.
- No new runtime dependencies. Art is hand-written SVG in code, like `src/components/GameIcons.tsx`. No image files, no image service.
- Style: "chunky cartoon": big round head, dark outlines about 3px on a 120×170 canvas (`#2b2b2b`), flat fills, brand green `#2F6B46`, gold `#F2B630`. Reference: option B in `.superpowers/brainstorm/*/content/avatar-style.html`.
- Points are never spent. Gear unlocks at lifetime-points milestones; nothing is deducted.
- Legendary rarity is earned-only (sources `level` or `badge`). Shop and Plus items are at most `epic` and are tagged "Shop" / "Plus" wherever they're listed.
- Shop prices: single items 199 cents, bundles 399–499 cents. Price always comes from the catalog on the server.
- Up to 2 clubs per person, from a fixed list in code. No clubs aimed at children.
- The share card shows the chef alone: no name, no title, no club badge.
- Club pages show counts, never member names.
- Schema changes: one idempotent numbered migration per change, run by hand in the Supabase SQL editor, with matching hand edits to `src/lib/database.types.ts`.

## Review Focus

- A person calls the save/equip action directly with an item they haven't unlocked or don't own: rejected, nothing saved. (Task 1 test, Task 5 action uses it.)
- Stripe delivers `checkout.session.completed` twice, and the success page also records the same session: exactly one `user_gear` row per item. (Task 6 test + manual check.)
- Plus lapses while a Plus item is equipped: that slot shows the slot's starter item; the saved choice survives and returns on resubscribe. (Task 1 test.)
- Saved avatar JSON is old, partial, out of range, or names an item no longer in the catalog: falls back per field, never throws. (Task 1 test.)
- Someone tries to buy an item they own, or a bundle where they own everything: no checkout is created. (Task 1 test.)

---

### Task 1: Avatar catalog and rules

**Files:**
- Create: `src/lib/avatar.ts`
- Test: `src/lib/avatar.test.ts`

**Interfaces:**
- Consumes: `LEVELS`, `levelFor`, `BADGES` from `src/lib/game.ts`; `BadgeId` from `src/lib/database.types.ts`.
- Produces:
  ```ts
  export type Slot = "hat" | "outfit" | "tool" | "background";
  export const SLOTS: Slot[];
  export type Rarity = "common" | "rare" | "epic" | "legendary";
  export type GearSource =
    | { kind: "starter" }
    | { kind: "level"; level: number }      // index into LEVELS
    | { kind: "points"; at: number }        // lifetime points milestone
    | { kind: "badge"; badge: BadgeId }
    | { kind: "plus" }
    | { kind: "shop"; cents: number };
  export type GearItem = { id: string; slot: Slot; name: string; rarity: Rarity; source: GearSource };
  export type Bundle = { id: string; name: string; cents: number; items: string[] };
  export const GEAR: GearItem[];
  export const GEAR_BY_ID: Record<string, GearItem>;
  export const BUNDLES: Bundle[];
  export type LookPart = "skin" | "eyes" | "brows" | "mouth" | "hair" | "hairColor" | "facialHair" | "glasses";
  export type Look = Record<LookPart, number>;  // option indices
  export const LOOK_OPTIONS: Record<LookPart, number>; // { skin: 8, eyes: 6, brows: 4, mouth: 6, hair: 10, hairColor: 8, facialHair: 4, glasses: 4 }
  export type Avatar = { look: Look; equipped: Partial<Record<Slot, string>> };
  export type GearContext = { points: number; badges: BadgeId[]; plus: boolean; owned: string[] };
  export function starterFor(slot: Slot): GearItem;
  export function defaultAvatar(userId: string): Avatar;
  export function parseAvatar(json: unknown, userId: string): Avatar;
  export function unlockedGear(ctx: GearContext): Set<string>;
  export function canSave(avatar: Avatar, unlocked: Set<string>): { ok: true } | { ok: false; message: string };
  export function visibleAvatar(avatar: Avatar, plus: boolean): Avatar;
  export function newUnlocks(unlocked: Set<string>, seen: string[]): string[];
  export function lockReason(item: GearItem): string;
  export function priceLabel(cents: number): string;
  export function purchasable(target: { item: string } | { bundle: string }, owned: string[]):
    { items: string[]; cents: number; name: string } | null;
  ```

- [ ] **Step 1: Write the failing tests** in `src/lib/avatar.test.ts` (style of `src/lib/diet.test.ts`):

```ts
test("catalog rules", () => {
  const ids = GEAR.map((g) => g.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const s of SLOTS) assert.equal(GEAR.filter((g) => g.slot === s && g.source.kind === "starter").length, 1);
  for (const g of GEAR.filter((g) => g.rarity === "legendary")) assert.ok(["level", "badge"].includes(g.source.kind), g.id);
  for (const g of GEAR.filter((g) => g.source.kind === "shop")) assert.ok(g.source.cents >= 199, g.id);
  LEVELS.forEach((_, i) => assert.ok(GEAR.some((g) => g.slot === "hat" && g.source.kind === "level" && g.source.level === i)));
  for (const b of BUNDLES) {
    assert.ok(b.cents >= 399 && b.cents <= 499);
    for (const id of b.items) assert.equal(GEAR_BY_ID[id]?.source.kind, "shop", id);
  }
});

test("unlocks follow points, badges, Plus and purchases", () => {
  const none = unlockedGear({ points: 0, badges: [], plus: false, owned: [] });
  assert.ok(GEAR.filter((g) => g.source.kind === "starter").every((g) => none.has(g.id)));
  assert.ok(!GEAR.some((g) => g.source.kind === "plus" && none.has(g.id)));
  const sous = unlockedGear({ points: 300, badges: ["crowd_favorite"], plus: true, owned: [SHOP_ITEM] });
  const levelHat = (n: number) => GEAR.find((g) => g.source.kind === "level" && g.source.level === n)!.id;
  assert.ok([0, 1, 2].every((n) => sous.has(levelHat(n))));
  assert.ok(!sous.has(levelHat(3)));
  assert.ok(sous.has(GEAR.find((g) => g.source.kind === "badge" && g.source.badge === "crowd_favorite")!.id));
  assert.ok(GEAR.filter((g) => g.source.kind === "plus").every((g) => sous.has(g.id)));
  assert.ok(sous.has(SHOP_ITEM));
  assert.ok(!none.has(SHOP_ITEM));
});

test("saving rejects locked or unknown gear and wrong slots", () => {
  const free = unlockedGear({ points: 0, badges: [], plus: false, owned: [] });
  const base = defaultAvatar("u1");
  assert.equal(canSave(base, free).ok, true);
  assert.equal(canSave({ ...base, equipped: { ...base.equipped, hat: PLUS_HAT } }, free).ok, false);
  assert.equal(canSave({ ...base, equipped: { hat: "no-such-item" } }, free).ok, false);
  assert.equal(canSave({ ...base, equipped: { outfit: starterFor("hat").id } }, free).ok, false);
  assert.equal(canSave({ ...base, look: { ...base.look, skin: 8 } }, free).ok, false);
});

test("Plus gear hides when Plus ends and the choice is kept", () => {
  const a = { look: defaultAvatar("u1").look, equipped: { hat: PLUS_HAT } };
  assert.equal(visibleAvatar(a, false).equipped.hat, starterFor("hat").id);
  assert.equal(visibleAvatar(a, true).equipped.hat, PLUS_HAT);
  assert.equal(a.equipped.hat, PLUS_HAT); // not mutated
});

test("bad saved JSON falls back per field and never throws", () => {
  assert.deepEqual(parseAvatar(null, "u1"), defaultAvatar("u1"));
  assert.deepEqual(parseAvatar("junk", "u1"), defaultAvatar("u1"));
  const p = parseAvatar({ look: { skin: 99, eyes: 2 }, equipped: { hat: "gone", tool: starterFor("tool").id } }, "u1");
  assert.equal(p.look.eyes, 2);
  assert.equal(p.look.skin, defaultAvatar("u1").look.skin);
  assert.equal(p.equipped.hat, undefined);
});

test("default avatar is steady per user and wears starter gear", () => {
  assert.deepEqual(defaultAvatar("abc"), defaultAvatar("abc"));
  assert.notDeepEqual(defaultAvatar("abc").look, defaultAvatar("xyz").look);
  for (const s of SLOTS) assert.equal(defaultAvatar("abc").equipped[s], starterFor(s).id);
});

test("buying: owned items and fully owned bundles can't be bought", () => {
  assert.equal(purchasable({ item: SHOP_ITEM }, [SHOP_ITEM]), null);
  assert.equal(purchasable({ item: PLUS_HAT }, []), null); // not a shop item
  const b = BUNDLES[0];
  assert.equal(purchasable({ bundle: b.id }, b.items), null);
  assert.deepEqual(purchasable({ bundle: b.id }, [b.items[0]])?.items, b.items.slice(1));
  assert.equal(purchasable({ bundle: b.id }, [b.items[0]])?.cents, b.cents);
});

test("labels", () => {
  assert.equal(priceLabel(199), "$1.99");
  assert.equal(lockReason(LEVEL_HAT_2), "Reach Sous chef");
  assert.equal(lockReason(PLUS_HAT), "Plus");
  assert.equal(newUnlocks(new Set([starterFor("hat").id, "x"]), []).includes(starterFor("hat").id), false);
});
```

(`SHOP_ITEM`, `PLUS_HAT`, `LEVEL_HAT_2` are ids picked from the catalog at the top of the test file.)

- [ ] **Step 2: Run** `npm test`. Expected: FAIL, `avatar.ts` not found.

- [ ] **Step 3: Implement `src/lib/avatar.ts`.** Catalog at launch, ids kebab-case: 4 starter items (one per slot), 5 level hats (`level` 0–4; level 4 hat is `legendary`), 4 points items at 250/500/1000/2500, one item for each of `crowd_favorite` (legendary), `chef_pick` (legendary), `thriftiest`, `streak_4`, `saved_100`, `saved_1000`, `brought_3`, about 6 `plus` items across slots, about 10 `shop` items at 199 and 2 bundles of 3–4 shop items at 399–499. Names and themes are yours: earned items themed on what was done, shop items on fun and style, never on achievements. Notes:
  - `defaultAvatar`: simple string hash of `userId` picks each look index; equips every slot's starter.
  - `parseAvatar`: zod `safeParse` per field; any missing or out-of-range look field takes the default's value; equipped ids not in `GEAR_BY_ID` or in the wrong slot are dropped.
  - `canSave`: look indices in range; each equipped id exists, matches its slot, and is in `unlocked`. Messages are short and plain ("That gear is locked.").
  - `visibleAvatar(a, plus)`: replaces any equipped `plus` item with `starterFor(slot).id` when `!plus`; empty slots stay empty.
  - `newUnlocks`: unlocked minus seen minus starters, in catalog order.
  - `lockReason`: level → `Reach ${LEVELS[n].name}`; points → `Earn ${at} points`; badge → `Earn the ${BADGES[b].label} badge`; plus → `Plus`; shop → `priceLabel(cents)`.

- [ ] **Step 4: Run** `npm test` and `npm run typecheck`. Expected: all pass.

- [ ] **Step 5: Commit**
```bash
git add src/lib/avatar.ts src/lib/avatar.test.ts
git commit -m "Avatar catalog: gear, unlock rules, validation, shop pricing"
```

### Task 2: Clubs list

**Files:**
- Create: `src/lib/clubs.ts`
- Test: `src/lib/clubs.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type Club = { id: string; name: string; blurb: string };
  export const CLUBS: Club[];          // 8–12, e.g. picky-eater-parents, dad-chef, cooking-with-my-kids, budget-cook, meal-prepper, cooking-for-one, date-night, plant-forward
  export const CLUB_BY_ID: Record<string, Club>;
  export const MAX_CLUBS = 2;
  export function cleanClubs(input: unknown): string[];  // known ids only, deduped, first MAX_CLUBS kept, order kept
  ```

- [ ] **Step 1: Write failing tests:** `cleanClubs(["dad-chef","dad-chef","nope","budget-cook","date-night"])` → `["dad-chef","budget-cook"]`; `cleanClubs("x")` → `[]`; ids unique; `CLUBS.length` between 8 and 12; every club whose name or blurb mentions `/\b(kid|kids|child|children|teen)\b/i` also matches `/\b(parent|parents|my kids|family)\b/i` (family clubs are framed for parents).
- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement** `src/lib/clubs.ts`.
- [ ] **Step 4: Run** `npm test`, `npm run typecheck`. Expected: pass.
- [ ] **Step 5: Commit** `git commit -m "Clubs list"` with both files.

### Task 3: Database and server reads

**Files:**
- Create: `supabase/migrations/0010_avatars.sql`
- Create: `src/lib/avatar-server.ts`
- Modify: `src/lib/database.types.ts` (profiles, new `user_gear`)
- Modify: `src/lib/data.ts` (`Profile`, `getMe` select, `Attempt`, `withNames`)
- Modify: `src/lib/game-server.ts` (`leaderboard` rows)
- Modify: `src/lib/savings-server.ts` (`topSavers` rows)
- Modify: `.gitignore` (add `.superpowers/`)

**Interfaces:**
- Consumes: Task 1 (`parseAvatar`, `visibleAvatar`, `GearContext`), Task 2 (`cleanClubs`), `hasPlus` from `src/lib/plan.ts`.
- Produces:
  ```ts
  // src/lib/avatar-server.ts ("server-only")
  export type ChefCard = { name: string | null; avatar: Avatar; clubs: string[] };
  export async function chefCards(userIds: string[]): Promise<Record<string, ChefCard>>; // one query; avatar already passed through visibleAvatar(…, hasPlus(profile))
  export async function gearContext(userId: string, plus: boolean): Promise<GearContext>; // points, badges, owned in parallel
  export async function myChef(userId: string): Promise<{ avatar: Avatar; saved: boolean; clubs: string[]; seen: string[]; ctx: GearContext; unlocked: Set<string> }>;
  ```
  - `Profile` gains `avatar: unknown; gear_seen: string[]; clubs: string[]`.
  - `Attempt` gains `chef: ChefCard` (keep `name` for existing callers).
  - `leaderboard()` and `topSavers()` rows gain `chef: ChefCard`.

- [ ] **Step 1: Write `0010_avatars.sql`** (idempotent, style of `0009_diets.sql`):
  - `profiles.avatar jsonb` (nullable), `profiles.gear_seen text[] not null default '{}'`, `profiles.clubs text[] not null default '{}'` with check `cardinality(clubs) <= 2`.
  - `user_gear(id bigint identity pk, user_id uuid not null references profiles on delete cascade, item_id text not null, source text not null check (source in ('shop','grant')), stripe_session_id text, created_at timestamptz not null default now(), unique (user_id, item_id))`.
  - RLS on `user_gear`; policy: select where `user_id = auth.uid()`. No insert/update/delete policies (server writes with service role).
  - A final `select` that reports the new columns, like `0009`.
- [ ] **Step 2: Update `database.types.ts`** to match.
- [ ] **Step 3: Implement `avatar-server.ts`.** `chefCards` selects `id, public_name, avatar, clubs, plan, subscription_status, bonus_until` with `.in("id", ids)`; reuse it inside `withNames`, `leaderboard` and `topSavers` in place of their own name lookups so boards still make one profile query.
- [ ] **Step 4: Run** `npm run typecheck`, `npm test`. Expected: pass.
- [ ] **Step 5: Run the migration** in the Supabase SQL editor; the final select shows the 3 new columns. Then `npm run dev` and load `/leaderboard` and `/cookoff`: pages render as before.
- [ ] **Step 6: Commit** migration, types, server files, `.gitignore`: `git commit -m "Avatars: schema, user_gear, batched chef cards"`.

### Task 4: Chef drawing

**Files:**
- Create: `src/components/ChefAvatar.tsx`
- Create: `src/app/admin/avatars/page.tsx` (admin-only art sheet)

**Interfaces:**
- Consumes: `Avatar`, `GEAR`, `LOOK_OPTIONS`, `SLOTS` from Task 1.
- Produces:
  ```tsx
  export function ChefAvatar(props: { avatar: Avatar; size?: number; head?: boolean; uid: string; title?: string }): JSX.Element;
  ```
  Plain function component, no hooks, works in server and client components. `head` crops the viewBox to the head and hat. `uid` prefixes every gradient/filter id so many chefs on one page don't collide. Layers back to front exactly as the spec lists them. Legendary items add the gold glow/sparkle; nothing else does.

- [ ] **Step 1: Draw the base**: 8 skin tones, 6 eyes, 4 brows, 6 mouths, 10 hair styles (incl. bald and one that sits well under hats), 8 hair colors, 4 facial hair, 4 glasses.
- [ ] **Step 2: Draw every catalog item** from Task 1 in its slot.
- [ ] **Step 3: Build `/admin/avatars`** (gate like `src/app/admin/page.tsx`): a grid of every look option on a fixed chef, every gear item on the default chef with name and rarity, and 12 `defaultAvatar` chefs; plus the same chefs at `size={32} head`.
- [ ] **Step 4: Verify**: `npm run typecheck`; open `/admin/avatars` in light and dark mode; every part and item draws, nothing overlaps wrongly, head crops keep the hat, two legendary chefs side by side both glow (ids don't collide).
- [ ] **Step 5: Commit** `git commit -m "Chef avatar drawing and admin art sheet"`.

### Task 5: My chef page

**Files:**
- Create: `src/app/chef/page.tsx`, `src/app/chef/actions.ts`, `src/components/ChefEditor.tsx` (client)
- Modify: `src/components/Header.tsx` (link the header chef to `/chef`), `src/app/account/page.tsx` (big chef + "Edit my chef" link)

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces (server actions, `Result` shape as in `src/app/actions.ts`):
  ```ts
  export async function saveChef(avatar: Avatar): Promise<Result>;   // canSave against myChef().unlocked
  export async function setClubs(clubs: string[]): Promise<Result>;  // cleanClubs
  export async function markGearSeen(ids: string[]): Promise<Result>; // appends known ids only
  ```

- [ ] **Step 1: Page** `/chef` (sign-in required, redirect like other pages): chef large in the middle; tabs **Look**, **Wardrobe**, **Clubs**, **Shop** (Shop filled in Task 6). Wardrobe lists all gear by slot, rarity border, "Shop"/"Plus" tag, locked items greyed with `lockReason`. Editor previews instantly and saves with one button. First visit (`saved === false`) opens on Look with a one-line nudge.
- [ ] **Step 2: Actions** in `src/app/chef/actions.ts`; each re-reads `myChef` on the server, never trusts the client's idea of what's unlocked; `revalidatePath("/chef")`, `"/account"`, `"/leaderboard"`, `"/cookoff"`.
- [ ] **Step 3: Header and account** show the chef (`head` in header, full on account with the person's club names under it).
- [ ] **Step 4: Verify**: typecheck, tests; in the browser, make a chef, equip a starter, reload: it sticks. Call `saveChef` with a Plus item on a free account (e.g. from devtools via the form): refused, nothing saved. Pick 3 clubs: only 2 kept.
- [ ] **Step 5: Commit** `git commit -m "My chef page: look, wardrobe, clubs"`.

### Task 6: Gear shop

**Files:**
- Create: `src/app/api/stripe/gear/route.ts`, `src/lib/gear-billing.ts`
- Modify: `src/app/api/stripe/webhook/route.ts`, `src/app/chef/page.tsx` (Shop tab, `?bought=` handling), `src/app/admin/actions.ts`, `src/app/admin/page.tsx`, `src/app/terms/page.tsx`, `README.md` (Before launch list)
- Test: `src/lib/avatar.test.ts` (purchase metadata round-trip)

**Interfaces:**
- Consumes: `purchasable` (Task 1), existing customer creation in `src/app/api/stripe/checkout/route.ts`.
- Produces:
  ```ts
  // src/lib/avatar.ts (pure, add)
  export function gearMetadata(items: string[]): string;          // "id1,id2"
  export function parseGearMetadata(s: string | null | undefined): string[]; // known shop ids only
  // src/lib/gear-billing.ts ("server-only")
  export async function recordGearPurchase(session: Stripe.Checkout.Session): Promise<number>; // rows added
  export async function refreshGearPurchase(userId: string, sessionId: string): Promise<number>;
  // src/app/admin/actions.ts
  export async function grantGear(userId: string, itemId: string): Promise<R>;
  export async function removeGear(userId: string, itemId: string): Promise<R>; // also unequips it
  ```

- [ ] **Step 1: Failing test**: `parseGearMetadata(gearMetadata([SHOP_ITEM, "nope", PLUS_HAT]))` → `[SHOP_ITEM]`; `parseGearMetadata(null)` → `[]`.
- [ ] **Step 2: Run** `npm test`. Expected: FAIL. **Step 3:** implement both. **Step 4:** `npm test` passes.
- [ ] **Step 5: Checkout route** `POST /api/stripe/gear`, form field `item` or `bundle`: sign-in required; `purchasable(…, owned)` or redirect back to `/chef?tab=shop`; reuse/create the Stripe customer as the Plus route does; `mode: "payment"`, one line item with `price_data: { currency: "usd", unit_amount: cents, product_data: { name } }`, `client_reference_id: user.id`, `metadata: { user_id, gear: gearMetadata(items) }`, `success_url: ${siteUrl}/chef?tab=wardrobe&bought={CHECKOUT_SESSION_ID}`, `cancel_url: ${siteUrl}/chef?tab=shop`.
- [ ] **Step 6: Recording**: `recordGearPurchase` returns 0 unless `mode === "payment"` and `payment_status === "paid"`; user from `client_reference_id`; upserts `user_gear` (`source: "shop"`, `stripe_session_id`) with `onConflict: "user_id,item_id", ignoreDuplicates: true`. Webhook: in `checkout.session.completed`, call it for payment-mode sessions. `/chef?bought=` calls `refreshGearPurchase`, which retrieves the session and checks `client_reference_id === userId` before recording.
- [ ] **Step 7: Shop tab and admin**: Shop tab lists shop items and bundles with price and Buy (a form posting to the route), hides Buy for owned items, shows a bundle only if `purchasable` is non-null. Admin page gets a small "Gear" section: user id + item → Grant / Remove.
- [ ] **Step 8: Terms and README**: add a short "Digital items" section to `/terms` (no cash value, not transferable, refunds at our discretion, tied to your account); add "digital items terms" to the README's lawyer review line.
- [ ] **Step 9: Verify end to end** with `npm run stripe:listen` and a test card: buy one item → it appears unlocked; open the success URL again and replay the event (`stripe events resend <id>`) → still exactly one row in `user_gear`; owned item has no Buy; bundle with one owned item still charges the bundle price and grants the rest.
- [ ] **Step 10: Commit** `git commit -m "Gear shop: one-time Stripe checkout, webhook and success-page recording, admin grants"`.

### Task 7: New gear celebration

**Files:**
- Create: `src/components/GearUnlock.tsx` (client)
- Modify: `src/components/Header.tsx`

**Interfaces:**
- Consumes: `myChef`, `newUnlocks` (Tasks 1, 3), `saveChef`, `markGearSeen` (Task 5), `celebrate` from `src/lib/celebrate.ts`, `ChefAvatar` (Task 4).
- Produces: `GearUnlock({ item: GearItem; avatar: Avatar; uid: string })`.

- [ ] **Step 1:** Header computes `newUnlocks(unlocked, seen)` for signed-in people and, if any, renders `GearUnlock` for the first one: confetti, the person's chef wearing the item, the item name and rarity, **Equip it** (saves with that item in its slot, then marks seen) and **Later** (marks seen). One per page load; the next shows on the next load.
- [ ] **Step 2: Verify**: give a test account a badge (or `grantGear` a shop item) → next page load celebrates it once; Equip it puts it on; reload shows nothing. Respects reduced motion (as `celebrate` already does).
- [ ] **Step 3: Commit** `git commit -m "Celebrate newly unlocked gear"`.

### Task 8: Chefs on boards, entries and the share card

**Files:**
- Create: `src/components/ClubBadge.tsx`
- Modify: `src/app/leaderboard/page.tsx`, `src/components/CookoffBoard.tsx`, `src/components/CookoffView.tsx`, `src/app/cookoff/e/[id]/page.tsx`, `src/components/ShareCard.tsx`, `CLAUDE.md`, `README.md`

**Interfaces:**
- Consumes: `ChefCard` on leaderboard/saver rows and `Attempt.chef` (Task 3), `ChefAvatar` (Task 4), `CLUB_BY_ID` (Task 2).
- Produces: `ClubBadge({ id: string })`: small pill with the club name, links to `/clubs/${id}` (page arrives in Task 9).

- [ ] **Step 1:** Put `ChefAvatar head` (about 36px) and up to two `ClubBadge`s next to every name on the leaderboard (points and savers views), cook-off board tiles, cook-off view and entry page. `uid` = user id + place, so ids are unique per page.
- [ ] **Step 2: Share card**: `ShareCard` takes an optional `chef?: Avatar`; draws the full chef in a lower corner by serializing a hidden `ChefAvatar` SVG (`XMLSerializer` → Blob URL → `Image` → `drawImage`, like the photo draw at `ShareCard.tsx:75`). No name, title or club.
- [ ] **Step 3: Docs**: `CLAUDE.md` "Where things live" rows for avatars, shop, clubs; "Product rules" lines for earned-only legendary, Shop/Plus tags, points never spent, no kids' clubs, club pages show counts only. `README.md` feature table rows for avatars, shop and clubs.
- [ ] **Step 4: Verify**: typecheck, tests, `npm run build`; leaderboard with 25+ demo rows loads with no extra network requests per row (check the browser's network panel); share card PNG shows the chef.
- [ ] **Step 5: Commit** `git commit -m "Show chefs and club badges on boards, entries and share cards"`.

### Task 9: Club pages

**Files:**
- Create: `supabase/migrations/0011_club_popular.sql`, `src/app/clubs/[id]/page.tsx`
- Modify: `src/lib/database.types.ts` (function type), `src/lib/data.ts` (`clubPopular`, `clubEntries`)

**Interfaces:**
- Produces:
  ```ts
  export async function clubPopular(clubId: string, limit?: number): Promise<{ recipe: Recipe; members: number }[]>;
  export async function clubEntries(clubId: string, limit?: number): Promise<Attempt[]>;
  ```

- [ ] **Step 1: SQL function** `club_popular(club text, max_rows int)` returning `(recipe_id uuid, members int)`: distinct `user_id`s whose `profiles.clubs` contains `club`, from `cook_log` union `saved_recipes`, counted per recipe, only `recipes.is_public`, ordered by members desc then most recent. `security definer`, `set search_path = public`, execute revoked from `anon`/`authenticated` and granted to `service_role`. Idempotent (`create or replace`).
- [ ] **Step 2: Data helpers**: `clubPopular` calls the function with the admin client then loads recipes with `RECIPE_COLUMNS`; `clubEntries` loads recent non-hidden attempts by club members through `withNames`.
- [ ] **Step 3: Page** `/clubs/[id]` (404 for unknown ids): club name and blurb, "Popular with <club>" recipe tiles (reuse `RecipeTile`) each showing "Made or saved by N members" (only recipes at least 3 members made or saved, so a small club never exposes one person), then recent cook-off entries. Counts only, no member names on recipe tiles.
- [ ] **Step 4: Verify**: run the migration; put two demo accounts in one club who cook/save the same public recipe → it shows "2 members"; a private recipe never shows; unknown club → 404.
- [ ] **Step 5: Commit** `git commit -m "Club pages: popular recipes and entries from club members"`.
