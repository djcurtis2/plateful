# Plateful

See `CLAUDE.md` for architecture, product rules and gotchas.

Snap a restaurant dish. Get the copycat recipe, see what you save per plate, shop the ingredients, and post "restaurant vs. mine."

Next.js 16 (App Router) · Tailwind CSS 4 · Supabase (Postgres, auth, storage) · Claude API (vision) · Stripe (subscriptions)

## What's in it

| Area | Where | Notes |
| --- | --- | --- |
| Photo → copycat recipe | `src/app/api/recognize/route.ts`, `src/lib/claude.ts` | Claude vision with structured output (JSON schema), so results are always valid JSON. Validated with zod. |
| Cost and abuse controls | `src/lib/limits.ts` | Site-wide daily cap, per-visitor / per-IP / per-plan limits, file-type sniffing, 5 MB cap, client-side downscaling to 1280px. |
| Recipe pages | `src/app/r/[slug]` | Public, shareable, with a generated social preview image (`opengraph-image.tsx`). |
| Servings, pantry, cart | `src/components/RecipeView.tsx` | Scales quantities, remembers ticked items in your pantry, groups the cart by aisle, links each item to Instacart, Walmart or Kroger search. |
| Share card | `src/components/ShareCard.tsx` | 1080×1350 "restaurant vs. mine" PNG with price gap and referral link. Uses the native share sheet on phones. |
| Referrals | `src/lib/referrals.ts`, `src/proxy.ts` | `?ref=` codes stored for 30 days. Friends get 7 days of Plus on sign-up. Every 3 friends who cook earns the referrer a free month. Rewards count cooks, never visits. |
| Cook-off | `src/app/cookoff` | Weekly challenge, photo entries, 3 votes per person, points, badges and prizes. |
| Accounts | `src/app/login`, `src/app/auth` | Magic link and Google sign-in via Supabase. |
| Library, pantry, account | `src/app/library`, `pantry`, `account` | Saved recipes, pantry editor, plan and referral progress. |
| Chef avatars | `src/components/ChefAvatar.tsx`, `src/lib/avatar.ts`, `src/app/chef` | Build a cartoon chef, unlock gear with points and badges, and show it beside your name on boards, entries and share cards. |
| Gear shop | `src/app/api/stripe/gear`, `src/lib/gear-billing.ts` | One-time Stripe checkout for shop gear; purchases recorded by the webhook and success page. |
| Chef clubs | `src/lib/clubs.ts`, `src/components/ClubBadge.tsx`, `src/app/clubs` | Pick up to two clubs; badges show next to your name and club pages show counts only. |
| Payments | `src/app/api/stripe/*` | Checkout, billing portal, webhook that keeps `profiles.plan` in sync. |
| Email list | `src/app/api/waitlist` | "Weekly copycat" sign-ups with referral attribution. |

## Setup

You need Node 20+ and accounts at Supabase, Anthropic and Stripe.

### 1. Install

```bash
npm install
cp .env.example .env.local
```

### 2. Supabase

1. Create a project at supabase.com.
2. Copy the project URL, anon key and service-role key from **Project Settings → API** into `.env.local`.
3. Open **SQL Editor**, paste `supabase/migrations/0001_init.sql`, and run it. Then run `supabase/seed.sql` for two sample copycats and a first cook-off.
4. **Authentication → URL Configuration:** set Site URL to `http://localhost:3000` (your real domain later) and add `http://localhost:3000/auth/callback` to Redirect URLs.
5. Optional: enable Google under **Authentication → Providers**. Without it, the Google button shows an error and magic links still work.

### 3. Claude API

Create a key at console.anthropic.com and set `ANTHROPIC_API_KEY`. `ANTHROPIC_MODEL` defaults to `claude-sonnet-5-5`.

### 4. Stripe

1. In test mode, create a product "Plateful Plus" with a $4.99 monthly price. Put the price ID (`price_…`) in `STRIPE_PRICE_PLUS_MONTHLY`.
2. Put your secret key in `STRIPE_SECRET_KEY`.
3. Turn on the customer portal: **Settings → Billing → Customer portal**.
4. For local webhooks, install the Stripe CLI and run `npm run stripe:listen`. Copy the `whsec_…` it prints into `STRIPE_WEBHOOK_SECRET`.
5. In production, add a webhook endpoint at `https://YOUR-DOMAIN/api/stripe/webhook` for `checkout.session.completed`, `checkout.session.async_payment_succeeded` and `customer.subscription.created / updated / deleted`.

### 5. Run

```bash
npm run dev        # http://localhost:3000
npm test           # unit tests for quantity, pantry and slug helpers
npm run typecheck
```

## Deploying (Vercel)

1. Push to GitHub and import the repo in Vercel.
2. Add every variable from `.env.local`, with `NEXT_PUBLIC_SITE_URL` set to your domain.
3. Update the Supabase Site URL and Redirect URLs to the production domain.
4. Add the production Stripe webhook (step 4.5 above) and switch to live keys when ready.

`/api/recognize` sets `maxDuration = 60`, which needs a Vercel plan that allows 60-second functions.

## Cost controls

Every photo scan is a paid Claude API call. Defaults in `.env.example`:

| Setting | Default | Meaning |
| --- | --- | --- |
| `DAILY_SCAN_CAP` | 2000 | Hard stop for the whole site per UTC day |
| `ANON_SCANS_PER_DAY` | 3 | Signed-out visitors (per browser; IPs get 5× this) |
| `FREE_SCANS_PER_WEEK` | 5 | Free accounts |
| `PLUS_SCANS_PER_DAY` | 40 | Plus subscribers |

Token usage is logged on every row of the `scans` table, so you can see real cost per scan:

```sql
select date(created_at), count(*), sum(input_tokens), sum(output_tokens)
from scans group by 1 order by 1 desc;
```

## Running a cook-off

Run `supabase/migrations/0002_gamification.sql` after `0001_init.sql` (already applied to the live project).

**The weekly loop**
1. Snap the dish you want to feature so it has a recipe page.
2. Open **/admin** (admins only; make an account admin with `update profiles set is_admin = true where id = '…';`) and schedule the cook-off with that recipe's URL.
3. During the week people post one entry each, get **3 votes** to spend (never on themselves), and share their entry page (`/cookoff/e/<id>`) to rally votes. Visitors must sign in to vote, which is the growth loop.
4. After voting closes, open **/admin**, choose the **Chef's pick**, then **Finalize**. That locks the Crowd favorite (most votes, earliest entry wins ties), gives both winners 3 months of Plus plus badges and points, awards Top 10 badges, and lists each winner's social feature under *Prizes to send*.
5. Each month, award the grocery gift card to the top scorer from **/admin**, then mark it sent.

**Points** (tune in `src/lib/game.ts`): entry +20, vote cast +2, vote received +5, friend signs up +25, friend cooks +50, weekly streak +10 × weeks, Top 10 +25, win +100. Levels run Line cook → Prep cook → Sous chef → Head chef → Executive chef.

**Moderation:** anyone signed in can report an entry; 3 reports hide it until you review it under *Reported entries* in /admin.

## Grocery partners

Cart items link to each store's search today. Instacart's Developer Platform offers shoppable recipe and shopping-list pages that fill a cart in one tap, and pays affiliate fees. Once approved, replace `STORES.instacart` in `src/lib/stores.ts` with a call that creates the list server-side and returns its URL.

## Before launch

- Have a lawyer review `/terms`, `/privacy`, the digital items terms (shop gear), and the use of restaurant names ("-style" naming, no logos or menu photos).
- Set a custom SMTP sender in Supabase (**Authentication → Emails**). The built-in sender is rate-limited and meant for testing.
- Add a moderation path for cook-off photos (the `hidden` column is there; an admin page is not).
- Label menu prices as typical estimates: they come from the model and vary by city.
