# Yumjack mobile app (iPhone first, Android later): design

Date: 2026-11-13. Status: approved by Dan 2026-11-13.

## Intent

Dan wants Yumjack in the Apple App Store (Google Play later). The why: the App Store is its own shop window. People browse and search it, and trust a downloaded app more than a website link, so being on that shelf opens more growth than the website alone. Marketing (TikTok, Instagram, Facebook @yumjackapp, a small Meta ad) started this week, so getting onto the shelf soon matters more than a perfect native feel.

Success: Yumjack is approved and live on the App Store worldwide, with phone features that make it a real app. It feels like an app to shoppers, and every website change keeps showing up in it without a new App Store submission.

## Goals

- An iPhone app that opens the live site (yumjack.app) inside a native shell, plus phone-only features:
  1. **Camera:** snapping a dish uses the phone's camera directly.
  2. **Notifications:** "today's trivia/games are ready" and "tonight's dinner" from Plan my week. Each cook chooses which they get; all off until they opt in.
  3. **Offline grocery list:** the grocery list (recipe and plan lists) keeps working, with check-offs, when the phone has no signal.
  4. **Share sheet:** share recipes and the "restaurant vs. mine" card via the phone's share sheet.
  5. **Sign-in:** email magic links open straight into the app. Google stays. Sign in with Apple is added (Apple requires it when Google is offered).
- **Payments, both ways side by side:** in the app, "Get Plus" and the gear shop offer "Pay with Apple" (Apple in-app purchase) and, on the US storefront, "Pay on yumjack.app" (the existing Stripe checkout). Outside the US, only Apple shows (link-outs without Apple's fee are a US court ruling). Same US prices both ways ($9.99/mo, $59.99/yr; gear at its shop prices); other countries get Apple's automatic local equivalents. Plus bought either way is Plus everywhere, app and website, on the same account.
- **Worldwide from the first release** (Dan's choice): every App Store country except mainland China (which needs a government license). See "Going global" below.
- Android (Google Play) later from the same shell with little extra work. Not part of this first release.

## Non-goals

- Rebuilding screens as native phone screens. (Possible later, one screen at a time, if the app takes off.)
- Android in this first release.
- Localizing the product: translations, local currencies for menu prices and home costs, non-US grocery stores. The site stays in English with US dollar prices and US stores.
- Changing what Plus includes, prices, or any product rule in CLAUDE.md.
- Selling anything new.

## Anti-goals (a failure even if it works)

- An app Apple rejects as "just a website."
- Anyone paying twice for Plus (Apple and Stripe at once) without being warned and pointed to cancel one.
- Plus turning off for someone still paying through either Apple or Stripe.
- The website getting worse or changing for website users. App-only features stay hidden on the website.
- Notifications that feel spammy: no marketing pushes, at most one of each kind a day, and none until the cook opts in.
- Breaking existing rules: legendary gear earned only; trivia answers never reach the browser early; receipts never stored; points never spent.

## Constraints

- **Dan works on Windows.** Building and signing an iPhone app needs a Mac with Xcode. Use a cloud Mac build service (Codemagic, which supports Capacitor and has a free monthly allowance, or GitHub Actions macOS runners) to build and upload to TestFlight/App Store Connect. No local Mac assumed.
- **Apple Developer Program:** Dan enrolls as a sole proprietor with his EIN ($99/yr, needs a D-U-N-S number; can take days to weeks). Nothing can be submitted until it's done.
- **Apple rules that apply:** 4.2 minimum functionality (the phone features above are the answer), 3.1.1 in-app purchase for digital goods (Apple checkout), US link-out to web purchase allowed after Epic v. Apple (currently 0% Apple fee; a court may set one, Apple proposed 5% for small businesses), 4.8 Sign in with Apple, 5.1.1(v) account deletion in the app (already exists: `components/DeleteAccount.tsx`), 1.2 user-generated content needs report and block (reporting exists for cook-off entries; check that blocking or hiding a user is covered before submission).
- **Apple Small Business Program:** Dan enrolls so Apple's cut is 15%, not 30%.
- Existing stack stays: Next.js on Vercel, Supabase, Stripe. Server changes follow CLAUDE.md (numbered idempotent migration `0018_…`, hand-edited `database.types.ts`, typecheck + tests before commits).
- CLAUDE.md says "no other runtime deps" for the website. The app shell has its own dependencies (Capacitor and plugins) in its own folder. Server-side additions should avoid new deps where reasonable (for example, sign APNs tokens with Node's `crypto`). Any new website/server dependency needs a stated reason.
- Never commit `.env*.local`, signing keys, or the APNs/App Store keys.

## Approaches considered

1. **Wrap the live site in a native shell (Capacitor) and add phone features.** *Picked.* A few weeks. Reuses everything; website updates show in the app at once; Android nearly free later. Risk is Apple's "just a website" rejection, which the phone features address.
2. **Rebuild the screens as a phone app (React Native/Expo), sharing `src/lib` logic.** A few months: all 29 pages and about 50 components rebuilt. Slightly smoother feel and low approval risk, but every future feature is built twice.
3. **Fully native (Swift, later Kotlin).** Most work, nothing reused, three versions to keep in step. Dropped.

Dan picked 1 because getting onto the App Store shelf soon, while marketing is starting, matters more than a slightly smoother scroll, and it closes no doors.

**Payments considered:** (a) link out to Stripe only, US only, 0% to Apple; (b) Apple checkout only, 15% cut, works everywhere; (c) no selling in the app. Dan chose **both (a) and (b) side by side**, so buyers pick the easy Face ID tap or the web. Apple checkout lets the app sell in every country; the Stripe link shows on the US storefront only.

## The design

### Shell

- A Capacitor app in a new `mobile/` folder in this repo (own `package.json`, `capacitor.config.ts`, `ios/` project; `android/` later).
- The shell loads `https://yumjack.app` (remote URL), limited to the yumjack.app domain. Links to other sites (Instacart, Kroger, Stripe Checkout, Terms links out) open in the in-app browser or Safari, not inside the shell.
- The site detects it's in the app (Capacitor's native platform check, plus a user-agent marker the shell appends) and only then shows app-only things: Apple pay buttons, notification settings, native camera/share. On the plain website nothing changes.
- A small bridge module on the site (e.g. `src/lib/native.ts`, client-only) wraps plugin calls so components call `nativeShare()`, `nativeCamera()` etc. and fall back to today's web behavior outside the app. Plugins are reached through Capacitor's injected bridge, so the website bundle doesn't need the plugin packages (builder's call on exactly how).
- App icon and splash from the existing green square + plate icon. Name "Yumjack".

### Camera

- `Snapper` (and other photo inputs: attempts, own recipe, cook-off posts) uses the Capacitor Camera plugin in the app: take a photo or pick from library. The website keeps its file input.
- Photo permission prompts carry plain-English reasons ("Yumjack uses your camera to snap a dish and find its recipe").

### Notifications

- Capacitor Push Notifications plugin; Apple Push (APNs) on iOS.
- New table `push_devices` (user_id, token, platform, created/last-seen) and notification choices per cook (e.g. `profiles.notify` jsonb or a small table): `daily_games` (trivia + games ready), `plan_dinner` (tonight's dinner from their current plan). Default: all off; the app asks once, at a sensible moment (after a first trivia play or after making a plan), not on first launch.
- An hourly job (Supabase `pg_cron` calling `/api/push/tick`, protected by a secret; hourly because send times are local) sends:
  - **Daily games:** once a day at a fixed local time on the device (e.g. 9am; builder's call), only if the current UTC day's trivia is approved and live (`trivia` rules unchanged). Skip cooks who already played that UTC day (matters in time zones far from UTC, where 9am local can still be the previous UTC day). Text names no answers.
  - **Tonight's dinner:** around 4pm in the cook's time zone if their plan has a dinner today. (Store a time zone on the device row; fall back to US Eastern if missing.) *Claude's call:* plans have no dates and day 0 always shows as Monday, so "today" matches the plan by the weekday labels the cook sees (Monday = day 0). Only the cook's most recent plan counts, only if it was made in the last 7 days, only for days the plan covers, and only while they have Plus. No plan-date migration.
- Sent straight to APNs with a token-based key (.p8). Dead tokens are removed when APNs says so.
- Settings screen (account page, app only): toggles per kind.

### Offline grocery list

- Today `GroceryList` keeps check-offs in `localStorage`, and the list itself comes from the server.
- In the app, whenever a grocery list (recipe or plan) is shown online, save a copy of the list and its check-offs to device storage (Capacitor Preferences or Filesystem).
- The shell bundles a small offline screen (plain HTML/JS inside `mobile/`), shown when the site can't load: "You're offline. Your saved grocery lists:" with the latest few lists and working check-offs. Check-offs made offline sync back to the site's local storage next time it loads.

### Share sheet

- In the app, share buttons (`ShareCard`, `ShareButton`, share-own-recipe, games share text) use the Capacitor Share plugin. Image cards are written to a temp file first, then shared. The website keeps `navigator.share` / copy link.

### Sign-in

- **Universal links:** serve `/.well-known/apple-app-site-association` from the site, claiming `/auth/callback` (and recipe pages, `/r/*`, so shared links open in the app). A magic link tapped on the phone opens the app, which loads the callback URL in the shell, so the sign-in code is exchanged in the same place it started. A link opened on another device still works on the web.
- **Google:** Google blocks sign-in inside embedded web views. In the app, start Google sign-in in the system browser sheet and return via the universal link. (Builder: confirm the Supabase PKCE code verifier is available where the callback lands, and adjust if not.)
- **Sign in with Apple:** native button in the app (Capacitor Sign in with Apple plugin) → Apple ID token → `supabase.auth.signInWithIdToken({ provider: "apple" })`. Also add "Continue with Apple" on the website login, so an Apple-created account can sign in on the web. Apple's "hide my email" relay addresses must be able to receive magic links (register the sending domain with Apple's private relay service).
- Referral attribution and the welcome card keep working for app sign-ins (same callback).
- **One account, not two** (*Claude's call*): Apple sign-in with a shared email lands on the existing account with that email. "Hide my email" would create a separate empty account, so: under the Apple button, "Already use Yumjack? Sign in with email or Google first, then connect Apple in your account." The account page gets "Connect Apple" (Supabase identity linking), so later Apple taps open the same account. No merge tool.

### Blocking (needed for Apple rule 1.2)

- Reporting exists; blocking doesn't. *Claude's call:* add a minimal "Block this cook" (on cook-off entries, attempts and photos) that hides that person's posts, photos and name from the blocker's own view (cook-off boards, attempts, leaderboards show them as hidden or skip them). Blocks are private; the blocked cook isn't told. New table `blocks` in migration `0018_…`. Votes and points are unaffected.

### Payments

- **Apple in-app purchase via RevenueCat** (handles receipts, renewals and Apple's server notifications; free under $2.5k monthly revenue, then 1%). Plugin `@revenuecat/purchases-capacitor` in the shell; RevenueCat's App User ID = the Supabase user id, set after sign-in. Buying requires being signed in.
- **Products in App Store Connect:** Plus monthly ($9.99) and yearly ($59.99) in one subscription group; each shop gear item and bundle as a non-consumable at its shop price.
- **Plus status from Apple:** a RevenueCat webhook (`/api/revenuecat/webhook`, verified with its auth header) records Apple subscription state per user in new columns or a small table (e.g. `apple_plan_until`, `apple_status`, `apple_product`). `hasPlus()` in `lib/plan.ts` becomes: live Stripe subscription OR live Apple subscription OR referral bonus. Stripe and Apple are tracked separately so one ending never switches off the other. A fallback refresh (ask RevenueCat's API on app open / after purchase) mirrors `refreshFromStripe`.
- **Gear from Apple:** the webhook (and a post-purchase refresh) records gear in `user_gear` with a new source `"apple"` (enum change) and the Apple transaction id for dedupe (analogous to `stripe_session_id`).
- **Bundles on Apple:** Apple prices are fixed, but our rule says owning part of a bundle never makes the rest cost more than singles (`purchasable`). So the Apple button for a bundle shows only when the cook owns none of its items; otherwise only the Stripe option (or singles) shows. *Builder's call, flagged for Dan.*
- **Stripe link-out (US storefront only):** "Pay on yumjack.app" opens the existing Stripe checkout in Safari/in-app browser, returning to the app via universal link to the existing success pages. Storefront country comes from StoreKit (via RevenueCat), so the link shows only to US-storefront buyers. Follow Apple's current US guideline wording and button rules for external purchase links.
- **No double paying:** if someone already has Plus through one route, the other route's buy button is replaced by "You have Plus (via Apple/website)". If both are ever live, the account page shows a notice to cancel one and where (Apple subscriptions are cancelled in iPhone Settings; Stripe in the existing portal).
- **Manage/cancel:** the account page in the app shows "Manage in Apple" for Apple subscribers (opens Apple's subscription page) and the Stripe portal for Stripe subscribers.
- **Refunds** for Apple purchases go through Apple. Apple refund events from RevenueCat end Plus and remove refunded gear automatically. (Stripe gear refunds stay manual via admin, as today.)
- **Which account owns an Apple purchase** (*Claude's call*): it follows the Yumjack account signed in when it was bought. If the same Apple ID taps "Restore purchases" while signed into a different Yumjack account, it moves to that account (RevenueCat's "transfer" setting), so nobody is pushed to pay twice.
- **Deleting an account with a live Apple subscription:** we can't cancel it for them, so the delete screen warns first and links to Apple's subscription page ("Cancel in iPhone Settings first, or you'll keep being charged").
- Launch code `YUMLAUNCH` stays Stripe-only. (Apple offer codes could mirror it later.)
- Terms/Privacy pages: mention Apple purchases, RevenueCat as a processor, push notification tokens.

### Going global

- **Countries:** all App Store storefronts except mainland China.
- **Prices:** set US prices in App Store Connect and let Apple generate local prices. Apple collects and pays VAT/sales tax on in-app purchases. Stripe link-out stays US-only, so Stripe tax setup doesn't change.
- **The product stays US-flavored** (*Claude's call*): English only, menu prices and home costs in US dollars, Kroger/Instacart buttons unchanged (they only work in the US/Canada). The App Store description says prices are US estimates. Hide the Kroger and Instacart buttons outside the US/Canada if the shopper's region is easy to tell (storefront country in the app); otherwise leave them.
- **Privacy and Terms:** add the basics for EU/UK (GDPR) and other regions: what's collected and why, the legal basis, how to get a copy or deletion (account deletion already exists), RevenueCat and Apple as processors, and a contact email. No cookie banner needed if the site still sets only necessary cookies (builder confirms).
- **Notifications:** times use the device's time zone (stored on the device row); the daily games push goes out at a fixed local time, not US Eastern.
- **Age rating and export compliance:** standard HTTPS only (exempt encryption); age rating from Apple's questionnaire (no kids' clubs, per COPPA rule).

### App Store listing (Dan, with drafts from Claude)

- Claude drafts: app name/subtitle, description, keywords, privacy "nutrition label" answers (email, photos, purchases, device ID for push, analytics), review notes (a demo account for Apple's reviewer, explanation of the phone features and both payment options), and screenshot plan (6.7" and 6.1" sizes; snap, recipe, savings, games, plan).
- Dan does: Apple Developer enrollment, Small Business Program, App Store Connect app record, agreements/tax/banking, creating keys (APNs .p8, App Store Connect API key for the build service, Sign in with Apple key) and pasting them into Vercel/RevenueCat/Codemagic himself, RevenueCat account, a TestFlight test on his iPhone, final submit.

## Order of work (for the plan)

1. Dan starts Apple enrollment now (long lead time).
2. Shell + universal links + sign-in (magic link, Google, Apple) working in TestFlight.
3. Camera, share sheet, offline grocery list.
4. Notifications (table, opt-in, cron, APNs).
5. Payments (RevenueCat, App Store products, webhook, `hasPlus`, gear source, double-pay guard, US link-out).
6. Listing, privacy answers, screenshots, review notes, submit.

## Left to the builder

- Exact Capacitor version and plugins (official Camera, Share, Push Notifications, Preferences, Browser, App; community Sign in with Apple; RevenueCat).
- Codemagic vs GitHub Actions for cloud builds.
- Exact schema for push devices, notification choices and Apple subscription state (migration `0018_…`).
- How the site detects the app and reaches plugins without bundling them into the website.
- Notification send times and wording (within the anti-goals).
- Offline screen look (match the site's colors).
