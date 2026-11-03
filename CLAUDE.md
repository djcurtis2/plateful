# Dupe Kitchen (formerly Plateful): notes for Claude

Snap a restaurant dish → copycat recipe, cost per plate vs. the menu, grocery list, and "restaurant vs. mine" sharing.
Owner: Dan. Live at https://plateful-amber.vercel.app (Vercel, deploys on every push to `main`).
The app was renamed from Plateful to Dupe Kitchen (2026-11-02). Internal names (the repo, the Vercel project, the Supabase project, the `plateful` IP salt, the `@demo.plateful.test` demo users, old migrations) still say plateful on purpose; user-facing text says Dupe Kitchen.
Dan likes explanations with a real-life analogy, short summaries, and no jargon dumps.

## Stack

- Next.js 16.4 App Router (`src/proxy.ts`, not middleware; `params`/`searchParams` are Promises), React 19, Tailwind 4 (`@theme inline` tokens in `src/app/globals.css`, light + dark).
- Supabase: Postgres, magic-link auth, storage buckets `dishes` and `attempts`. Server writes use the service-role client in `src/lib/supabase/admin.ts`; RLS is on everywhere.
- Claude API via `@anthropic-ai/sdk` in `src/lib/claude.ts`. Model from `ANTHROPIC_MODEL` (default `claude-sonnet-5-5`). That model does NOT support forced `tool_choice`: use `output_config: { format: { type: "json_schema", schema } }`. Those schemas need `additionalProperties: false`, every property in `required`, nullable via type arrays, and no min/max (ranges go in descriptions; zod enforces them after).
- Stripe subscriptions (test mode, account "Plateful"). Plus = $4.99/mo or $39.99/yr (`STRIPE_PRICE_PLUS_YEARLY`; the yearly button hides until it is set). Shown prices live in `lib/plan.ts`.
- zod 4, qrcode. No other runtime deps; confetti etc. are hand-written.

## Commands

```bash
npm run dev          # localhost:3000
npm run typecheck    # tsc --noEmit
npm test             # node --test on src/lib/*.test.ts (pure logic)
npm run build
npm run stripe:listen  # forwards Stripe test events locally; prints the local whsec_
```

Run typecheck + tests before every commit. In PowerShell, quote comma lists (e.g. `--events "a,b"`).

## Database

Migrations in `supabase/migrations/0001…0016` are all applied to the one Supabase project (used by both local and live).
New schema changes: add the next numbered file (`0017_…sql`, idempotent: `if not exists`, drop/re-add constraints), run it in the Supabase SQL editor, and update `src/lib/database.types.ts` by hand to match.
`supabase/launch_cleanup.sql` (pre-launch) removed the fake cooks (`@demo.plateful.test`) and `demo:` points and kept the sample recipes as house recipes without the `-demo` slug ending. Don't run `demo_leaderboard.sql` or `demo_cleanup.sql` on the live database again: fake people and points must never show to real users, and `demo_cleanup.sql` would delete house recipes still named `-demo`.

## Where things live

| Area | Files |
| --- | --- |
| Photo → recipe | `app/api/recognize/route.ts`, `lib/claude.ts` (`recognizeDish`), `lib/recipe.ts` (zod + JSON schema) |
| Limits / cost control | `lib/limits.ts`: site-wide `DAILY_SCAN_CAP` over all Claude calls; per-person quotas (guests 1 scan ever, free accounts 3 a week, Plus 40 a day; env `GUEST_SCANS`, `FREE_SCANS_PER_WEEK`, `PLUS_SCANS_PER_DAY`). Receipts (`RECEIPT_SCAN`) and new recipes (`LEFTOVER_SCAN`) are logged in `scans` with their own marker and don't use dish-scan quotas. |
| Data access | `lib/data.ts` (`RECIPE_COLUMNS` + `toRecipe`: add new recipe columns in both) |
| Server actions | `app/actions.ts`, `app/plan/actions.ts`, `app/admin/actions.ts`. Only export async actions from `"use server"` files; read helpers go in `lib/`. |
| Cook-off + game | `lib/game.ts` (pure: points, levels, badges, prizes, receipt rules), `lib/game-server.ts` (ledger, finalize), `cast_vote` SQL function |
| Use it up / originals | `lib/leftovers.ts`, `lib/originals.ts` (`createOriginal`, `createVersion`, shared daily limit) |
| Plan my week (Plus) | `lib/planner.ts` (pure: spots per day × meal, greedy picks, leftovers, `summarizeWeek`), `app/plan/*` (week, `pick` page), `components/PlanForm.tsx`, `RecipePicker.tsx`. Plans store `slots` (jsonb); older plans only have `recipe_ids` and read as one dinner a day (`legacySlots`). |
| Own recipes | `lib/own-recipes.ts` (`createOwnRecipe`, `OWN_RECIPES_PER_DAY`), `priceOwnRecipe` in `lib/claude.ts`, `addOwnRecipe` / `deleteOwnRecipe` in `app/actions.ts`, `/library/new`, `components/OwnRecipeForm.tsx`. Logged in `scans` as `OWN_SCAN`. Share by link: `recipes.share_token`, `/r/<slug>?k=<token>` (`getSharedRecipe`, `ShareOwnRecipe`, `CopySharedRecipe`, `shareOwnRecipe` / `stopSharingOwnRecipe` / `copySharedRecipe`). |
| Savings | `lib/savings.ts` (pure), `lib/savings-server.ts` (`cook_log`, badges, totals) |
| Diets + versions | `lib/diet.ts` (pure), `components/VersionMaker.tsx`, `DietChips.tsx`, `DietForm.tsx` |
| Payments | `app/api/stripe/*`, `lib/billing.ts` (`syncSubscription`, `refreshFromStripe` fallback) |
| Avatars | `lib/avatar.ts` (pure: catalog, rarity, unlock rules), `lib/avatar-server.ts` (`chefCards`, `chefFrom`, `ownedGear`), `components/ChefAvatar.tsx` + `components/chef/*` (art), `/chef` page. `ChefCard` rows ride on leaderboard, savers and `Attempt`; names show with `ChefAvatar head` + `ClubBadge`. Share card draws the chef by serializing a hidden SVG. |
| Gear shop | `app/api/stripe/gear` (one-time checkout), `lib/gear-billing.ts` (records purchases from the webhook and success page), admin grants |
| Daily trivia | `lib/trivia.ts` (pure: UTC day, streak, points, share text, Claude schema), `lib/trivia-server.ts` (questions, plays, `recordTriviaPick`), `app/trivia/*`, `components/TriviaGame.tsx`, `writeTrivia` in `lib/claude.ts`, admin "Daily trivia" section (draft a week, approve/discard days) |
| Clubs | `lib/clubs.ts` (fixed list, `CLUB_BY_ID`, `cleanClubs`), `components/ClubBadge.tsx`, `/clubs/[id]` |
| Daily games | `lib/games.ts` (pure: seeded daily picks, Guess the Dish views/hints/points, Higher or Lower scoring, Bingo squares/lines), `lib/games-server.ts` (`game_days`, `game_plays`, `bingoFor`), `app/games/*`, `components/DishGuessGame.tsx`, `HigherLowerGame.tsx`, `ShareButton.tsx`, `app/api/games/dish-image` (hides the photo's file name). Spec: `docs/games.md` |
| Install on phone | `app/manifest.ts`, `app/apple-icon.png`, `public/icons/*` (green square + plate, inside the maskable safe zone), `appleWebApp` in `app/layout.tsx`. No app-store app yet: in-app payments there would need Apple/Google billing. |
| Admin | `app/admin` (only `profiles.is_admin`): judging, prizes, reference photos, backfills (package sizes, diet tags), sample recipes |

## Product rules (keep these)

- **Plus gating:** free = leftover list + 1 suggestion (rest blurred), 1 lifetime try of new recipes/versions, example plan only. Plus = all suggestions, 15 new recipes or versions a day, Plan my week. Diet profile and filters are free.
- **Savings are honest estimates:** counted only when someone cooks ("I made it", plan "Made it", cook-off post), once per recipe per day, servings capped at 8. Compare per plate: copycats use `menu_price / menu_serves`; others use Claude's `out_price` (similar takeout), else `AVERAGE_OUT` by meal. Always label as estimates.
- **Per plate everywhere:** use `menuPlate()` / `savings()` from `lib/recipe.ts`, never raw `menu_price`, when comparing with home cost.
- **Planner costs:** `bill` = whole packages bought; `used` = what the meals eat. Recipes without `pack_qty` use their `plate_cost` for meal cost. A leftover lunch means the dinner before it is cooked double; the two split its cost.
- **Plan my week:** any of breakfast, lunch, dinner, snack for 3–7 days. "Plan it for me" or start empty and pick. Dinners never repeat; breakfasts and snacks rotate up to 3 favorites; odd-day lunches (and lunches short of recipes) are last night's leftovers. Cooks can put any public recipe or their own in any spot (checked server-side with `getUsableRecipe`).
- **Own recipes:** free for any signed-in cook (10 a day); private (`is_public` false, `source` "own"), labeled "My recipe", no versions, sharing or public gallery; only their owner can delete them. Claude adds prices and keeps the cook's ingredients and steps. The owner can share one by private link (never listed or indexed; turning it off kills the link). Viewers see no name and can "Save a copy", which becomes their own private recipe (`inspired_by` = the original), unaffected by later changes. Public sharing of own recipes is not built yet: it needs an "it's my own recipe" checkbox, admin approval, a report button and a takedown contact in the Terms.
- **Diets are a guide, not an allergy guarantee:** show `ALLERGY_NOTE`. Tags are derived in code from Claude's `contains` list (`dietTagsFrom`). Untagged recipes never count as fitting a diet. A diet version that still breaks its diet is not saved.
- **Originals and versions:** never named after or attributed to a real chef, person or restaurant. Versions keep the original's restaurant and menu price. First photo posted for a recipe without one becomes its picture.
- **Receipts are never stored:** read once by Claude, only the result (price, store, date) is kept.
- **Names in ads need opt-in:** `profiles.feature_me`. Site-wide totals need no names.
- **Cook-off:** one entry per person per dish; 3 votes per person per cook-off, no self-votes; winners: Crowd favorite, Chef's pick, Thriftiest copy (receipt-verified only).
- **Daily trivia:** 3 questions a day (UTC), same for everyone, one go per signed-in person; guests can play without points. Answers never reach the browser before a pick. 1 point per right answer + 5 every 7th day in a row (kind `trivia`, no `challenge_id`). Trivia points count for levels and gear, never the monthly prize (`monthlyTop` excludes them). Questions go live only after an admin approves the day; no real restaurants, chefs, people or brands.
- **Daily games:** Guess the Dish and Higher or Lower are one go per person per UTC day, same puzzle for everyone, picked once and stored in `game_days`; guests play without points. Bingo is weekly (Monday UTC) and ticks itself from activity. Game points (kind `game`) count for levels and gear, never the monthly prize. Nothing is bought or left to chance.
- **Chef avatars:** legendary gear is earned only (points, badges), never sold or Plus-gated. Shop items carry a Shop tag and Plus items a Plus tag. Points are never spent: gear unlocks, it doesn't cost points. Bundles cost less than their items bought singly, and owning part of one never makes the rest cost more than buying those items singly (`purchasable`). No clubs aimed at kids (COPPA); family clubs are written for parents. Club pages show counts only (no member lists).
- **Sample/stock photos:** Unsplash only, no visible brand logos.

## Gotchas

- `NEXT_PUBLIC_*` values are baked in at build time: change them in Vercel, then redeploy.
- Stripe: each webhook endpoint has its own `whsec_`. Local uses the `stripe listen` secret (`.env.local`); Vercel uses the "Plateful live site" endpoint's secret.
- Supabase auth redirect allow-list must include `<site>/auth/callback` for every site address.
- In the SQL editor, statements with `drop … if exists` trigger a "destructive operation" confirm; that's expected.
- The gear shop webhook branch uses `checkout.session.completed` and `checkout.session.async_payment_succeeded` (both forwarded by `stripe:listen`; add the second to the live endpoint too). Gear checkout is cards only.
- Never commit `.env*.local`. Never paste secret keys into code or chat.
