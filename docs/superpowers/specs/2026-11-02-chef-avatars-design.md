# Chef avatars and gear: design

Date: 2026-11-02. Owner: Dan. Status: draft for approval.

## Why

Dan wants Plateful to be fun to come back to, not "just another recipe app." The model is the MMORPG feeling of getting new gear and seeing it on your character right away. Today the game layer is points, five levels (Line cook → Executive chef), badges, streaks and the weekly cook-off. People's progress shows up only as a title and small icons. Avatars give that progress a face people can show off.

This is the first of three linked projects, built in this order:

1. **Chef avatars and gear, plus clubs** (this document; club pages come right after the avatars)
2. **Daily streaks**, Duolingo-style: open the app each day to keep a streak going
3. **Daily "guess the ingredients" game**

Streaks and the daily game are designed separately later. Here they matter only because they will pay out gear, so the gear system must let new kinds of unlocks plug in without rework.

## Goals

- Everyone who signs in has a cartoon chef they designed in under a minute, looking roughly like them if they want.
- Gear goes on top in slots. New gear shows on the character the moment it's equipped.
- Gear comes three ways, all available at launch:
  - **Earned** by playing: levels, points milestones, badges, cook-off wins. Never for sale.
  - **Plus**: extra gear for Plateful Plus subscribers, an added reason to subscribe.
  - **Shop**: style-only gear bought with real money through Stripe, for extra revenue.
- Unlocking new gear is a moment: a celebration and an "Equip it" button, not something people find later by accident.
- The avatar shows wherever a person's name and title show, so people see each other's gear.

## Non-goals

- Selfie-to-cartoon generation, AI-generated art, or any per-user image cost.
- 3D, rigged animation, or poses. A small sparkle or glow on the rarest gear is the limit.
- Spending points. Points still decide the leaderboard and the monthly gift card. Gear *unlocks* when lifetime points pass a milestone; nothing is deducted.
- Trading, gifting, or selling gear between people.
- Streaks and the daily game themselves (later projects).
- An in-app currency ("coins"). Shop items are bought directly in dollars.

## Anti-goals (would count as failure even if it works)

- **Pay to look accomplished.** If a shop item can be mistaken for an earned one, earned gear stops meaning anything. Earned gear and shop gear must look different in kind (see "Rarity and the earned look").
- **A chore.** If making a chef takes more than about a minute, or new people face an empty grey placeholder on the leaderboard, it hurts more than it helps.
- **Slower pages.** The leaderboard and cook-off boards show many avatars. They must not add image downloads or extra database round trips per person.
- **Breaking existing product rules** in `CLAUDE.md` (names in ads need opt-in, Plus gating, etc.).

## The look

Style is the "chunky cartoon" direction Dan picked from mockups: big round head, bold dark outlines (about 3px at a 120×170 canvas), expressive eyes and mouth, small rounded body, flat fills with at most a soft highlight. The rarest earned gear borrows a gold glow from the "heroic" mockup. Brand colors: green `#2F6B46`, gold `#F2B630`.

The mockup sketch is in `.superpowers/brainstorm/` (option B), useful as a starting reference, not final art.

The art is hand-written SVG drawn in layers, in code, in the same way `src/components/GameIcons.tsx` draws level and badge icons today. No image files, no external service. *(My call.)*

### Layers, back to front

1. Background (gear slot)
2. Body and arms, skin tone
3. Outfit / apron (gear slot)
4. Head, skin tone
5. Face: eyes, brows, mouth
6. Hair (behind the hat where they overlap)
7. Facial hair
8. Glasses
9. Hat (gear slot)
10. Held tool (gear slot), in the right hand
11. Effects: sparkle or glow for legendary gear

### What people choose (free, everyone)

| Part | Launch options *(my call on counts)* |
| --- | --- |
| Skin tone | 8 |
| Eyes | 6 |
| Brows | 4 |
| Mouth | 6 |
| Hair style | 10, including bald and hair that suits head coverings |
| Hair color | 8 |
| Facial hair | 4 including none |
| Glasses | 4 including none |

### Gear slots

Hat, outfit (apron or jacket), held tool, background. One item per slot. Any slot can be empty.

## Getting gear

Every item lives in one catalog in code (`src/lib/avatar.ts`, pure, tested), with an id, slot, name, rarity, and **how it's obtained**:

| Source | Unlocked when | Examples |
| --- | --- | --- |
| `starter` | always | plain white apron, paper toque, wooden spoon, kitchen-tile background |
| `level` | reach a level (from lifetime points, as `levelFor` does today) | one hat per level, from paper toque up to the Executive chef's tall gold-band toque |
| `points` | lifetime points pass a milestone | aprons and tools at e.g. 250, 500, 1000, 2500 |
| `badge` | hold a badge in `user_badges` | Crowd favorite golden ladle, Chef's pick jacket, Thriftiest coupon apron, Saved $1,000 money-print apron, 4-week streak flame apron |
| `plus` | has Plus right now (`hasPlus(profile)`, which includes referral and prize Plus time) | about 6 items: a velvet chef jacket, a copper whisk, a bistro background... |
| `shop` | bought | about 10 items plus 2 bundles at launch (see Shop) |

Reserved for later projects, not built now: `streak` (daily streak milestones) and `daily` (daily game rewards). The catalog's source type must make adding them a one-line change per item.

**Earned gear is worked out on the fly**, not stored. Gear from `level`, `points`, `badge` and `plus` is derived each time from data Plateful already has (lifetime points, badges, plan). So nothing needs backfilling, and existing players unlock their gear the first time they open the avatar screen. *(My call: avoids a second source of truth.)*

**Bought gear is stored**, because a purchase is a fact Stripe told us about.

**Plus gear when Plus ends:** the items stay visible in the wardrobe as locked ("Plus"). If one is equipped, the avatar shows the default for that slot until Plus comes back, and the saved choice is kept so it reappears when they resubscribe. *(My call.)*

### Rarity and the earned look

Four rarities: common, rare, epic, legendary. Shown as a colored border in the wardrobe.

- **Legendary is earned-only.** Only cook-off winner items and the Executive chef hat are legendary, and only legendary gear gets the gold glow or sparkle.
- **Shop and Plus gear can be at most epic**, and each carries a small tag in the wardrobe and on hover/tap ("Shop" or "Plus") so nobody mistakes it for an achievement.
- Earned gear is themed on what was done (a winner's ladle, a savings apron). Shop gear is themed on fun and style (a taco spatula, a holiday hat, a pizza-peel staff), never on achievements.

## The shop (live at launch)

- **Prices** *(my call, Dan can change)*: single items $1.99, bundles of 3–4 themed items $3.99–$4.99. Stripe fees (about 30¢ + 2.9%) take too big a share of anything cheaper.
- **Who can buy:** signed-in people only. Shop gear belongs to the account.
- **Payment:** Stripe Checkout in one-time `payment` mode, reusing the existing Stripe customer setup in `src/app/api/stripe/checkout/route.ts`. The price comes from the catalog on the server, never from the browser. Stripe Products and Prices are not set up by hand per item; the server passes the item's name and amount to Checkout directly. *(My call: adding an item is a code change only.)*
- **Delivery:** the existing webhook (`src/app/api/stripe/webhook/route.ts`) already receives `checkout.session.completed`. For `mode === "payment"` sessions, record the items bought. Recording must be safe to run twice (Stripe retries), so purchases are keyed by Checkout session and item. As with `refreshFromStripe` for Plus, returning to the success page also checks the session with Stripe directly, so gear appears even if the webhook is late or missed locally.
- **Already owned:** the shop hides Buy for items you own. A bundle shows only what's new to you and its price is unchanged. *(My call: simpler, and bundles are cheap.)*
- **Refunds** are handled by hand in the Stripe dashboard. An admin can remove a bought item from someone in `/admin`. No automatic refund handling at launch.
- **Receipt and legal:** Stripe emails the receipt. The `/terms` page needs a short section on digital items (no cash value, not transferable, refunds at our discretion); add it to the README's "Before launch" lawyer list.

## Data

New migration `supabase/migrations/0010_avatars.sql`, idempotent like the others, and matching hand edits to `src/lib/database.types.ts`.

- `profiles.avatar jsonb`: the look (part choices) and equipped item per slot. Null means "not made yet".
- `profiles.gear_seen text[]`: item ids the person has already been told about, so new unlocks can be celebrated once.
- `user_gear` table: `user_id`, `item_id`, `source` (`shop` or `grant`), `stripe_session_id` (null for grants), `created_at`. Unique on `(user_id, item_id)`. RLS: people read their own rows; writes only from the server with the service-role client.

Saving a look or equipping an item goes through a server action that validates against the catalog and against what this person has unlocked or owns. Never trust what the browser says they own.

## Screens

- **My chef** (new page, linked from the header avatar and the account page): the chef big in the middle, with tabs for **Look** (part choices), **Wardrobe** (all gear by slot, unlocked ones equippable, locked ones showing how to get them: "Reach Sous chef", "Win a cook-off", "Plus", "$1.99"), and **Shop**. Locked earned gear is shown on purpose: it's the "what can I get next" pull.
- **First visit:** people who haven't made a chef get one picked at random but steady (based on their user id) so nobody is a grey blank. The header and account page nudge them to make it theirs. Making one takes one screen.
- **New gear moment:** when someone loads a page and has unlocked gear they haven't seen, show a celebration (reuse `src/lib/celebrate.ts`) with the item drawn on their chef and an **Equip it** button. Then mark it seen. Starter gear counts as seen from the start. There are no real players yet, so launch day needs no special "here's everything you already earned" screen; demo accounts can simply celebrate each item.

## Where the avatar appears

Next to the person's name and title in:

- the header (head only, small)
- the account page
- leaderboard rows (`src/app/leaderboard/page.tsx`)
- cook-off boards and entry pages (`CookoffBoard.tsx`, `CookoffView.tsx`, `src/app/cookoff/e/[id]/page.tsx`)
- the "restaurant vs. mine" share card (`ShareCard.tsx`): **the chef alone, with no name or title**. The card shows no name today, and adding one would bring in the "names in ads need opt-in" rule. *(My call.)*

Avatars render inline as SVG from the saved `avatar` JSON already loaded with the profile, so a leaderboard of 50 people adds no image requests. Add `avatar` (and whatever is needed to decide Plus-gear visibility) to the existing batched name lookups in `src/lib/data.ts` (`publicNames`, `withNames`), so boards still make no extra round trips per person.

## Clubs

Dan's idea: people join clubs that say who they cook as or for, like "Picky Eater Parents" or "Dad Chef", so others can relate and find recipes that work for people like them. Built in two parts:

**Part A, with the avatars:** the club badge.
- A fixed list of clubs in code (`src/lib/clubs.ts`), run by Plateful, not created by users, so there are no names to moderate. 8–12 at launch, for example Picky Eater Parents, Dad Chef, Cooking with My Kids, Budget Cook, Meal Prepper, Cooking for One, Date Night, Plant-Forward. Exact list left to the builder; Dan can edit it.
- Each person picks up to two clubs, chosen on the My chef page, changeable anytime. Stored as `profiles.clubs text[]` in the same `0010` migration, validated against the list on save.
- A small club badge shows next to the chef and title wherever the avatar appears (not on the share card).
- **No kids' clubs.** A club aimed at children invites under-13 sign-ups, which brings in COPPA. Family clubs are framed for parents ("Cooking with My Kids").

**Part B, right after avatars and before daily streaks:** club pages.
- `/clubs/[id]` per club: "Popular with Picky Eater Parents" lists the recipes club members cook (`cook_log`) and save (`saved_recipes`) most, ranked by how many distinct members did so. Shows counts, never member names, so nobody's cooking history is exposed. *(My call.)*
- Club members' cook-off entries can appear there too, since entries are already public.
- Tapping a club badge anywhere opens its page.
- The ranking query should run in the database (a SQL function or view), not by loading all logs into the app.

## Testing

Pure logic in `src/lib/avatar.ts`, covered by `src/lib/avatar.test.ts`: which items a given person has unlocked (level, points, badges, Plus, owned), validation of a saved look and equipped gear, the Plus-ended fallback, the steady random default, and catalog rules (unique ids, legendary is earned-only, shop/Plus items are never legendary, every shop item has a price). Typecheck and tests before each commit, as `CLAUDE.md` says. The shop should be tried end to end with Stripe test mode and `npm run stripe:listen`.

## Left to the builder

- All the art: drawing every part and item in the chosen style, within the counts above.
- Exact launch catalog, names, milestone numbers and which shop items go in bundles.
- Page layout and component structure.
- How the share card draws the avatar (it builds a PNG in the browser today).
