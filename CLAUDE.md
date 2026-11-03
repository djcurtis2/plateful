# Plateful: notes for Claude

Snap a restaurant dish → copycat recipe, cost per plate vs. the menu, grocery list, and "restaurant vs. mine" sharing.
Owner: Dan. Live at https://plateful-amber.vercel.app (Vercel, deploys on every push to `main`).
Dan likes explanations with a real-life analogy, short summaries, and no jargon dumps.

## Stack

- Next.js 16.4 App Router (`src/proxy.ts`, not middleware; `params`/`searchParams` are Promises), React 19, Tailwind 4 (`@theme inline` tokens in `src/app/globals.css`, light + dark).
- Supabase: Postgres, magic-link auth, storage buckets `dishes` and `attempts`. Server writes use the service-role client in `src/lib/supabase/admin.ts`; RLS is on everywhere.
- Claude API via `@anthropic-ai/sdk` in `src/lib/claude.ts`. Model from `ANTHROPIC_MODEL` (default `claude-sonnet-5-5`). That model does NOT support forced `tool_choice`: use `output_config: { format: { type: "json_schema", schema } }`. Those schemas need `additionalProperties: false`, every property in `required`, nullable via type arrays, and no min/max (ranges go in descriptions; zod enforces them after).
- Stripe subscriptions (test mode, account "Plateful"). Plus = $4.99/mo.
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

Migrations in `supabase/migrations/0001…0012` are applied to the one Supabase project (used by both local and live).
New schema changes: add the next numbered file (`0013_…sql`, idempotent: `if not exists`, drop/re-add constraints), run it in the Supabase SQL editor, and update `src/lib/database.types.ts` by hand to match.
`supabase/demo_*.sql` add demo data; `demo_cleanup.sql` removes it (slugs ending `-demo`, `@demo.plateful.test` users, `samples/` photos).

## Where things live

| Area | Files |
| --- | --- |
| Photo → recipe | `app/api/recognize/route.ts`, `lib/claude.ts` (`recognizeDish`), `lib/recipe.ts` (zod + JSON schema) |
| Limits / cost control | `lib/limits.ts`: site-wide `DAILY_SCAN_CAP` over all Claude calls; per-person quotas. Receipts (`RECEIPT_SCAN`) and new recipes (`LEFTOVER_SCAN`) are logged in `scans` with their own marker and don't use dish-scan quotas. |
| Data access | `lib/data.ts` (`RECIPE_COLUMNS` + `toRecipe`: add new recipe columns in both) |
| Server actions | `app/actions.ts`, `app/plan/actions.ts`, `app/admin/actions.ts`. Only export async actions from `"use server"` files; read helpers go in `lib/`. |
| Cook-off + game | `lib/game.ts` (pure: points, levels, badges, prizes, receipt rules), `lib/game-server.ts` (ledger, finalize), `cast_vote` SQL function |
| Use it up / originals | `lib/leftovers.ts`, `lib/originals.ts` (`createOriginal`, `createVersion`, shared daily limit) |
| Plan my week (Plus) | `lib/planner.ts` (pure greedy planner), `app/plan/*` |
| Savings | `lib/savings.ts` (pure), `lib/savings-server.ts` (`cook_log`, badges, totals) |
| Diets + versions | `lib/diet.ts` (pure), `components/VersionMaker.tsx`, `DietChips.tsx`, `DietForm.tsx` |
| Payments | `app/api/stripe/*`, `lib/billing.ts` (`syncSubscription`, `refreshFromStripe` fallback) |
| Avatars | `lib/avatar.ts` (pure: catalog, rarity, unlock rules), `lib/avatar-server.ts` (`chefCards`, `chefFrom`, `ownedGear`), `components/ChefAvatar.tsx` + `components/chef/*` (art), `/chef` page. `ChefCard` rows ride on leaderboard, savers and `Attempt`; names show with `ChefAvatar head` + `ClubBadge`. Share card draws the chef by serializing a hidden SVG. |
| Gear shop | `app/api/stripe/gear` (one-time checkout), `lib/gear-billing.ts` (records purchases from the webhook and success page), admin grants |
| Clubs | `lib/clubs.ts` (fixed list, `CLUB_BY_ID`, `cleanClubs`), `components/ClubBadge.tsx`, `/clubs/[id]` |
| Admin | `app/admin` (only `profiles.is_admin`): judging, prizes, reference photos, backfills (package sizes, diet tags), sample recipes |

## Product rules (keep these)

- **Plus gating:** free = leftover list + 1 suggestion (rest blurred), 1 lifetime try of new recipes/versions, example plan only. Plus = all suggestions, 15 new recipes or versions a day, Plan my week. Diet profile and filters are free.
- **Savings are honest estimates:** counted only when someone cooks ("I made it", plan "Made it", cook-off post), once per recipe per day, servings capped at 8. Compare per plate: copycats use `menu_price / menu_serves`; others use Claude's `out_price` (similar takeout), else `AVERAGE_OUT` by meal. Always label as estimates.
- **Per plate everywhere:** use `menuPlate()` / `savings()` from `lib/recipe.ts`, never raw `menu_price`, when comparing with home cost.
- **Planner costs:** `bill` = whole packages bought; `used` = what the dinners eat. Recipes without `pack_qty` use their `plate_cost` for meal cost.
- **Diets are a guide, not an allergy guarantee:** show `ALLERGY_NOTE`. Tags are derived in code from Claude's `contains` list (`dietTagsFrom`). Untagged recipes never count as fitting a diet. A diet version that still breaks its diet is not saved.
- **Originals and versions:** never named after or attributed to a real chef, person or restaurant. Versions keep the original's restaurant and menu price. First photo posted for a recipe without one becomes its picture.
- **Receipts are never stored:** read once by Claude, only the result (price, store, date) is kept.
- **Names in ads need opt-in:** `profiles.feature_me`. Site-wide totals need no names.
- **Cook-off:** one entry per person per dish; 3 votes per person per cook-off, no self-votes; winners: Crowd favorite, Chef's pick, Thriftiest copy (receipt-verified only).
- **Chef avatars:** legendary gear is earned only (points, badges), never sold or Plus-gated. Shop items carry a Shop tag and Plus items a Plus tag. Points are never spent: gear unlocks, it doesn't cost points. No clubs aimed at kids (COPPA); family clubs are written for parents. Club pages show counts only (no member lists).
- **Sample/stock photos:** Unsplash only, no visible brand logos.

## Gotchas

- `NEXT_PUBLIC_*` values are baked in at build time: change them in Vercel, then redeploy.
- Stripe: each webhook endpoint has its own `whsec_`. Local uses the `stripe listen` secret (`.env.local`); Vercel uses the "Plateful live site" endpoint's secret.
- Supabase auth redirect allow-list must include `<site>/auth/callback` for every site address.
- In the SQL editor, statements with `drop … if exists` trigger a "destructive operation" confirm; that's expected.
- The gear shop webhook branch uses `checkout.session.completed` and `checkout.session.async_payment_succeeded` (both forwarded by `stripe:listen`; add the second to the live endpoint too). Gear checkout is cards only.
- Never commit `.env*.local`. Never paste secret keys into code or chat.
