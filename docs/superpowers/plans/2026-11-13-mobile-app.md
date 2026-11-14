# Yumjack iPhone App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Yumjack to the App Store worldwide as a Capacitor shell around yumjack.app, with camera, notifications, offline grocery lists, share sheet, Sign in with Apple, blocking, and Apple + Stripe payments side by side.

**Architecture:** A new `mobile/` folder holds a Capacitor iOS app that loads `https://yumjack.app` and appends `YumjackApp/1` to its user agent. The website detects the app and reaches native plugins through Capacitor's injected `window.Capacitor` bridge (no plugin packages in the website bundle), falling back to today's web behavior elsewhere. Server additions (APNs push, RevenueCat webhook, blocking, Apple sign-in) live in the existing Next.js app and one migration, `0018_mobile_app.sql`.

**Tech Stack:** Capacitor 7 (iOS, Swift Package Manager), Capacitor plugins (Camera, Share, Push Notifications, Preferences, Browser, App, Filesystem), `@capacitor-community/apple-sign-in`, `@revenuecat/purchases-capacitor`; Next.js 16.4, Supabase, Stripe (existing); Codemagic for cloud macOS builds; Supabase `pg_cron` + `pg_net` for the hourly push job.

**Spec:** `docs/superpowers/specs/2026-11-13-mobile-app-design.md`

## Global Constraints

- Bundle id `app.yumjack.ios`; app name "Yumjack"; Apple Team ID from env `APPLE_TEAM_ID` (never hard-coded).
- Website behavior must not change outside the app: every app-only UI is gated on `isNativeApp()` (Task 3).
- No new runtime dependencies in the root `package.json`. Native plugin packages live only in `mobile/package.json`. APNs JWTs are signed with Node `crypto` (ES256).
- Same prices both ways: Plus `$9.99/mo`, `$59.99/yr`; gear at its `avatar.ts` shop price. Apple product ids: `yumjack_plus_monthly`, `yumjack_plus_yearly`, `gear_<item_id with - → _>`, `bundle_<bundle_id with - → _>`.
- Stripe link-out ("Pay on yumjack.app") shows only when the App Store storefront is `USA`. Apple checkout shows in every storefront. Countries: all except mainland China.
- Notifications are off until the cook opts in; at most one of each kind per day; no marketing pushes; text never contains trivia answers.
- Plus = live Stripe subscription OR `apple_until` in the future OR `bonus_until` in the future. Stripe and Apple are tracked separately; one ending never clears the other.
- Existing rules hold: legendary gear earned only, points never spent, trivia answers never reach the browser before a pick, receipts never stored, `YUMLAUNCH` stays Stripe-only.
- Every schema change goes in `supabase/migrations/0018_mobile_app.sql` (idempotent) and is mirrored by hand in `src/lib/database.types.ts`.
- `npm run typecheck` and `npm test` pass before every commit. Never commit `.env*.local`, `.p8` keys, or signing files. Commit and push only when Dan asks.
- User-facing text says Yumjack, plain English, no jargon.

## Review Focus

1. **Cook already has Plus via Stripe opens the app's Plus page:** no Apple buy button; it says "You have Plus (via yumjack.app)". (Test: `plusOffers` in Task 2.)
2. **Apple subscription lapses while Stripe is live (or the reverse):** Plus stays on. (Test: `hasPlus` cases in Task 1.)
3. **RevenueCat sends the same event twice, or events out of order** (EXPIRATION arrives after a newer RENEWAL): `apple_until` never moves backward from a stale event. (Test: `applyAppleEvent` in Task 9.)
4. **Cook in Sydney at 9am local, which is still the previous UTC day:** no "trivia is ready" push if they already played that UTC day, and no push if that day isn't approved. (Test: `dailyGamesDue` in Task 8.)
5. **Owns 1 of 3 items in a bundle on Apple:** the Apple button for that bundle is hidden (Apple can't lower the price); Stripe or singles still offered. (Test: `appleBundleAllowed` in Task 2.)

---

### Task 0: Dan's accounts and keys (no code; can start today)

Dan does these himself; Claude walks him through each when he's ready. Nothing in Tasks 10–12 can finish without them; Tasks 1–9 can be built and tested on the web meanwhile.

- [ ] Get a D-U-N-S number for "Yumjack" (sole proprietor, EIN), then enroll in the Apple Developer Program as an organization ($99/yr).
- [ ] Enroll in the App Store Small Business Program (15% rate).
- [ ] In App Store Connect: accept the Paid Apps agreement; add tax (EIN) and bank info.
- [ ] Create the App ID `app.yumjack.ios` with capabilities: Push Notifications, Sign in with Apple, Associated Domains, In-App Purchase.
- [ ] Create keys and paste them only into the places named (never chat or code): APNs key `.p8` → Vercel env `APNS_KEY_P8`, `APNS_KEY_ID`; Sign in with Apple Services ID + key → Supabase Auth Apple provider; App Store Connect API key → Codemagic and RevenueCat.
- [ ] Register `yumjack.app`'s sending address (the Supabase SMTP sender) with Apple's Private Email Relay so "Hide my email" users get magic links.
- [ ] Create a RevenueCat account/project, connect the App Store app; set Vercel envs `REVENUECAT_WEBHOOK_AUTH`, `REVENUECAT_SECRET_KEY`; RevenueCat public iOS key goes in `mobile/` config (public, safe to commit). Set RevenueCat "Restore behavior" to **Transfer to new App User ID**.
- [ ] Create a Codemagic account linked to the GitHub repo.
- [ ] Set Vercel env `APPLE_TEAM_ID`, `APPLE_BUNDLE_ID=app.yumjack.ios`, `PUSH_CRON_SECRET`.

### Task 1: Migration 0018 and Plus from Apple

**Files:**
- Create: `supabase/migrations/0018_mobile_app.sql`
- Modify: `src/lib/database.types.ts` (profiles, user_gear, new tables)
- Modify: `src/lib/plan.ts:1-13`
- Modify: profile selects that feed `hasPlus`: `src/lib/data.ts:101`, `src/lib/avatar-server.ts:17` and `:81` (add `apple_until`)
- Test: `src/lib/plan.test.ts` (new)

**Interfaces:**
- Produces: `ProfilePlanFields` gains `apple_until: string | null`; `hasPlus(p, now?)` unchanged signature.
- Produces tables/columns (exact names):
  - `profiles`: `apple_until timestamptz null`, `apple_status text null`, `apple_product text null`, `notify jsonb not null default '{}'` (keys `daily_games`, `plan_dinner`, booleans).
  - `user_gear.source` check allows `'shop' | 'grant' | 'apple'`; new `apple_transaction_id text null` with a unique index where not null.
  - `push_devices(id bigserial pk, user_id uuid fk profiles on delete cascade, token text unique not null, platform text check in ('ios','android'), time_zone text null, storefront text null, created_at, last_seen_at)`; RLS on, no public policies (service role only).
  - `push_sends(user_id uuid, kind text check in ('daily_games','plan_dinner'), day date, primary key (user_id, kind, day))`: one send per kind per local day.
  - `blocks(blocker_id uuid, blocked_id uuid, created_at, primary key (blocker_id, blocked_id), check blocker_id <> blocked_id)`; RLS: a user can select/insert/delete rows where `blocker_id = auth.uid()`.

- [ ] **Step 1: Write the failing test** `src/lib/plan.test.ts`

```ts
const base = { plan: "free" as const, subscription_status: null, bonus_until: null, apple_until: null };
const now = new Date("2026-12-01T00:00:00Z");
test("apple plus counts while apple_until is ahead", () => {
  assert.equal(hasPlus({ ...base, apple_until: "2026-12-05T00:00:00Z" }, now), true);
  assert.equal(hasPlus({ ...base, apple_until: "2026-11-30T00:00:00Z" }, now), false);
});
test("stripe and apple are independent", () => {
  assert.equal(hasPlus({ ...base, plan: "plus", subscription_status: "active", apple_until: "2026-11-01T00:00:00Z" }, now), true);
  assert.equal(hasPlus({ ...base, plan: "free", subscription_status: "canceled", apple_until: "2027-01-01T00:00:00Z" }, now), true);
});
test("no source means free", () => assert.equal(hasPlus(base, now), false));
```

- [ ] **Step 2:** Run `npm test` → FAIL (`apple_until` not in type / ignored).
- [ ] **Step 3:** Add `apple_until` to `ProfilePlanFields` and the OR in `hasPlus`; write the migration (idempotent: `add column if not exists`, drop/re-add the `user_gear_source_check`, `create table if not exists`); mirror types; add `apple_until` to the three selects.
- [ ] **Step 4:** `npm test` and `npm run typecheck` → PASS.
- [ ] **Step 5:** Dan runs `0018_mobile_app.sql` in the Supabase SQL editor (expect the destructive-operation confirm).
- [ ] **Step 6:** Commit `feat: schema for app push, Apple purchases and blocking`.

### Task 2: Pure app rules (`lib/app-shell.ts`)

**Files:**
- Create: `src/lib/app-shell.ts`
- Test: `src/lib/app-shell.test.ts`

**Interfaces:**
- Produces:
  - `APP_UA_MARKER = "YumjackApp/"`; `isAppUserAgent(ua: string | null): boolean`
  - `type PlusSource = "stripe" | "apple" | "bonus" | null`; `plusSource(p: ProfilePlanFields & {}, now?): PlusSource` (stripe first, then apple, then bonus)
  - `type PlusOffers = { apple: boolean; stripe: boolean; note: string | null }`; `plusOffers(source: PlusSource, storefront: string | null): PlusOffers`
  - `stripeLinkAllowed(storefront: string | null): boolean` (true only for `"USA"`)
  - `groceryStoresShown(storefront: string | null): boolean` (true for `"USA"`, `"CAN"`, or null = website)
  - `appleProductForGear(target: { item: string } | { bundle: string }): string`; `gearForAppleProduct(id: string): { item: string } | { bundle: string } | null` (only known ids)
  - `appleBundleAllowed(bundleId: string, owned: string[]): boolean` (true only if the cook owns none of its items)
  - `aasa(teamId: string, bundleId: string): object` (apple-app-site-association JSON claiming `/auth/callback*`, `/r/*`, `/recipe/*` or whatever recipe path exists, `/plan*`, `/trivia*`, `/games*`, `/pricing*`, `/account*`)

- [ ] **Step 1: Write the failing tests** (`app-shell.test.ts`), including:

```ts
test("user agent marker", () => {
  assert.equal(isAppUserAgent("Mozilla/5.0 ... YumjackApp/1"), true);
  assert.equal(isAppUserAgent("Mozilla/5.0 Safari"), false);
  assert.equal(isAppUserAgent(null), false);
});
test("offers: nothing to buy when already Plus", () => {
  assert.deepEqual(plusOffers("stripe", "USA"), { apple: false, stripe: false, note: "You have Plus (via yumjack.app)" });
  assert.deepEqual(plusOffers("apple", "USA"), { apple: false, stripe: false, note: "You have Plus (via Apple)" });
});
test("offers: both in the US, Apple only elsewhere", () => {
  assert.deepEqual(plusOffers(null, "USA"), { apple: true, stripe: true, note: null });
  assert.deepEqual(plusOffers(null, "GBR"), { apple: true, stripe: false, note: null });
  assert.deepEqual(plusOffers("bonus", "USA"), { apple: true, stripe: true, note: null }); // bonus time can still upgrade
});
test("gear product ids round-trip and reject unknowns", () => {
  assert.equal(appleProductForGear({ bundle: "party-night" }), "bundle_party_night");
  assert.deepEqual(gearForAppleProduct("bundle_party_night"), { bundle: "party-night" });
  assert.equal(gearForAppleProduct("gear_not_a_thing"), null);
});
test("bundle on Apple only when owning none of it", () => {
  assert.equal(appleBundleAllowed("party-night", []), true);
  assert.equal(appleBundleAllowed("party-night", ["tuxedo"]), false);
});
test("grocery stores and stripe link by storefront", () => {
  assert.equal(stripeLinkAllowed("USA"), true); assert.equal(stripeLinkAllowed("CAN"), false);
  assert.equal(groceryStoresShown("CAN"), true); assert.equal(groceryStoresShown("FRA"), false); assert.equal(groceryStoresShown(null), true);
});
test("aasa lists the app and the callback", () => {
  const j = aasa("TEAM123", "app.yumjack.ios") as any;
  assert.equal(j.applinks.details[0].appIDs[0], "TEAM123.app.yumjack.ios");
  assert.ok(JSON.stringify(j).includes("/auth/callback"));
});
```

- [ ] **Step 2:** `npm test` → FAIL (module missing).
- [ ] **Step 3:** Implement in `src/lib/app-shell.ts` (pure; imports `GEAR_BY_ID`, `BUNDLES` from `avatar.ts` and `ProfilePlanFields` from `plan.ts`). Check the real recipe page path with `ls src/app` before writing `aasa` paths.
- [ ] **Step 4:** `npm test`, `npm run typecheck` → PASS.
- [ ] **Step 5:** Commit `feat: pure rules for the app shell, offers and Apple product ids`.

### Task 3: Native bridge, camera and share sheet

**Files:**
- Create: `src/lib/native.ts` (client-only)
- Modify: `src/components/Snapper.tsx:125`, `AttemptForm.tsx`, `OwnRecipeForm.tsx` (if it has a photo input), `NewChallengeForm.tsx` photo inputs: in the app, a button calls `nativePhoto()` and feeds the returned `File` into the same handler the `<input type="file">` uses.
- Modify: `ShareCard.tsx:326`, `ShareButton.tsx`, `ShareOwnRecipe.tsx`, `SavingsCard.tsx`, `TriviaGame.tsx` share calls → `nativeShare(...)`.
- Modify: `src/app/layout.tsx`: add `<html data-app>` only when the request user agent matches `isAppUserAgent` (read with `headers()`), for CSS tweaks like safe-area padding (`env(safe-area-inset-*)` on the header and bottom nav).

**Interfaces:**
- Consumes: `isAppUserAgent` (Task 2).
- Produces (all safe to call on the website; they no-op or fall back):
  - `isNativeApp(): boolean` (`window.Capacitor?.isNativePlatform?.() === true`)
  - `plugin<T>(name: string): T | null` (reads `window.Capacitor.Plugins[name]`)
  - `nativePhoto(): Promise<File | null>` (Camera.getPhoto, `resultType: "uri"`, source prompt; null if cancelled or not native)
  - `nativeShare(opts: { text: string; url?: string; file?: Blob; fileName?: string }): Promise<"shared" | "fallback">` (writes `file` to Filesystem cache then Share.share with `files`; returns `"fallback"` when not native so callers run today's `navigator.share`/copy path)
  - `appStorefront(): Promise<string | null>` (RevenueCat `getStorefront`, cached; null on web)
  - `openExternal(url: string): Promise<void>` (Browser.open in app; `window.location.href` on web)

- [ ] **Step 1:** Implement `native.ts` with a typed `CapacitorWindow` interface (no plugin packages imported).
- [ ] **Step 2:** Wire the photo inputs and share calls listed above. On the web the code path must be byte-for-byte today's behavior when `isNativeApp()` is false.
- [ ] **Step 3:** `npm run typecheck`, `npm test`, `npm run build` → PASS.
- [ ] **Step 4:** Preview the site locally (`npm run dev`) and confirm snap, attempt photo and share still work in a normal browser (no regressions).
- [ ] **Step 5:** Commit `feat: native camera and share sheet inside the app, web unchanged`.

### Task 4: Offline grocery lists

**Files:**
- Create: `src/lib/offline-lists.ts` (pure: list shape + trimming) and `src/lib/offline-lists.test.ts`
- Modify: `src/components/GroceryList.tsx` (plan list) and `src/components/RecipeView.tsx` cart section: when `isNativeApp()`, call `saveOfflineList(...)` after render and on each tick.
- Create (in Task 5's folder, written here): `mobile/www/offline.html` + `mobile/www/offline.js`: reads Preferences key `yj_offline_lists`, shows the lists with tick boxes, saves ticks back to the same key. Site colors from `globals.css` (green `#2F6B46`, background `#f3f5f0`, dark `#111813`).

**Interfaces:**
- Produces:
  - `type OfflineList = { id: string; title: string; kind: "plan" | "recipe"; lines: { key: string; text: string; aisle: string | null }[]; ticks: string[]; savedAt: string }`
  - `upsertOfflineList(all: OfflineList[], list: OfflineList, max = 5): OfflineList[]` (replace same id, newest first, keep `max`)
  - `mergeTicks(siteTicks: string[], offlineTicks: string[], offlineNewer: boolean): string[]`
  - In `native.ts`: `saveOfflineList(list: OfflineList): Promise<void>` and `readOfflineTicks(id: string): Promise<string[] | null>`; the plan list merges offline ticks into `pf_plan_ticks_<planId>` on load.

- [ ] **Step 1: Failing tests**: `upsertOfflineList` keeps 5 newest, replaces by id and moves it to the front; `mergeTicks` prefers offline ticks when newer and site ticks otherwise.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implement; wire components; write `offline.html/js` (plain JS, no build step).
- [ ] **Step 4:** `npm test`, `npm run typecheck` → PASS.
- [ ] **Step 5:** Commit `feat: grocery lists saved for offline use in the app`.

### Task 5: Capacitor shell, universal links, cloud build

**Files:**
- Create: `mobile/package.json` (Capacitor 7 core/cli/ios + plugins listed in Tech Stack), `mobile/capacitor.config.ts`, `mobile/ios/` (generated by `npx cap add ios --packagemanager SPM`), `mobile/README.md` (how to build, for Dan), `codemagic.yaml`
- Create: `src/app/.well-known/apple-app-site-association/route.ts` (GET → `aasa(process.env.APPLE_TEAM_ID, process.env.APPLE_BUNDLE_ID)` as `application/json`, 404 if env unset)
- Modify: `.gitignore` (mobile/node_modules, Pods, DerivedData, `*.p8`, `*.mobileprovision`)

**Interfaces:**
- Consumes: `aasa` (Task 2); `mobile/www/offline.html` (Task 4).
- Produces: `capacitor.config.ts` values: `appId: "app.yumjack.ios"`, `appName: "Yumjack"`, `webDir: "www"`, `server: { url: "https://yumjack.app", errorPath: "offline.html", allowNavigation: ["yumjack.app"] }`, `ios: { appendUserAgent: "YumjackApp/1", contentInset: "automatic" }`.
- iOS project settings: Associated Domains `applinks:yumjack.app`; Info.plist `NSCameraUsageDescription` = "Yumjack uses your camera to snap a dish and find its recipe.", `NSPhotoLibraryUsageDescription` = "Yumjack lets you pick a photo of a dish from your library."; `ITSAppUsesNonExemptEncryption = false`; icon from `public/icons/icon-512.png` (1024 version), splash background `#f3f5f0`.
- An `App` plugin `appUrlOpen` listener (in `mobile/www` boot script or native `AppDelegate`) loads incoming universal-link URLs in the web view, so `/auth/callback?code=…` runs inside the app.

- [ ] **Step 1:** Write the AASA route; test by `npm run dev` then `curl localhost:3000/.well-known/apple-app-site-association` with env set → JSON with `TEAM.app.yumjack.ios`. Confirm `src/proxy.ts` doesn't redirect or rewrite it (add to the matcher's exclusions if it does).
- [ ] **Step 2:** Scaffold `mobile/` and the iOS project; set the values above.
- [ ] **Step 3:** Write `codemagic.yaml`: workflow `ios-testflight` on manual trigger: `npm ci` in `mobile/`, `npx cap sync ios`, automatic signing via App Store Connect API key, build `.ipa`, publish to TestFlight.
- [ ] **Step 4:** Commit `feat: Capacitor iOS shell and universal links`.
- [ ] **Step 5 (needs Task 0):** Dan triggers the Codemagic build; installs from TestFlight; check: app opens yumjack.app, user agent marker present (`/account` can show it for admins, or check `data-app` via safe-area layout), airplane mode shows the offline screen with a saved list, tapping a yumjack.app link in Notes opens the app.

### Task 6: Sign-in in the app (magic link, Google, Apple, Connect Apple)

**Files:**
- Modify: `src/components/LoginForm.tsx`: in the app, Google sign-in uses `signInWithOAuth({ options: { skipBrowserRedirect: true, redirectTo: <site>/auth/callback } })` and opens the returned URL with `openExternal` (system browser; the universal link brings `/auth/callback` back into the app). Add "Continue with Apple" (web and app) and, under it in the app, the note: "Already use Yumjack? Sign in with email or Google first, then connect Apple in your account."
- Create: `src/lib/apple-signin.ts` (client): `signInWithApple(): Promise<{ error: string | null }>` (app: community plugin → `supabase.auth.signInWithIdToken({ provider: "apple", token, nonce })` with a hashed nonce; web: `signInWithOAuth({ provider: "apple" })`).
- Modify: `src/app/account/page.tsx`: "Connect Apple" button when the user has no Apple identity (`supabase.auth.linkIdentity({ provider: "apple" })`), hidden once linked.
- Modify: `src/app/auth/callback/route.ts` only if needed (see Step 2).

**Interfaces:**
- Consumes: `isNativeApp`, `openExternal` (Task 3).

- [ ] **Step 1:** Implement; on the website confirm magic link, Google and the new Apple button all reach `/library` (Apple needs Task 0's Supabase provider set).
- [ ] **Step 2:** In TestFlight: magic link from Mail opens the app signed in; Google returns to the app signed in. If the PKCE verifier is missing when the callback lands in the app (error `link_expired`), switch the app's Google flow to pass the code into the web view via the `appUrlOpen` handler, and document the fix in `mobile/README.md`.
- [ ] **Step 3:** In TestFlight: Apple sign-in with a shared email lands on the existing account with that email; "Connect Apple" then Apple sign-in with hidden email reaches the same account.
- [ ] **Step 4:** `npm run typecheck`, `npm test` → PASS. Commit `feat: Sign in with Apple, Google and magic links inside the app`.

### Task 7: Block a cook

**Files:**
- Create: `src/lib/blocks.ts` (pure) + `src/lib/blocks.test.ts`
- Create: `src/lib/blocks-server.ts`: `blockedIds(userId: string | null): Promise<Set<string>>`
- Modify: `src/app/actions.ts`: `blockCook(userId: string): Promise<Result>`, `unblockCook(userId: string): Promise<Result>` (signed-in only; not self)
- Modify: `src/components/EntryChips.tsx` / `CookoffBoard.tsx` (next to the existing Report control): "Block this cook" with a confirm ("You won't see their posts, photos or name. They won't be told.")
- Modify: cook-off pages, attempts lists, leaderboard and savers lists: filter with `withoutBlocked`.
- Modify: `src/app/account/page.tsx`: "Blocked cooks" list with Unblock.

**Interfaces:**
- Produces: `withoutBlocked<T>(rows: T[], blocked: Set<string>, userIdOf: (row: T) => string | null): T[]`

- [ ] **Step 1: Failing test:** `withoutBlocked` drops rows whose user id is blocked, keeps rows with null user id, and keeps order.
- [ ] **Step 2:** `npm test` → FAIL. **Step 3:** Implement and wire. **Step 4:** `npm test`, `npm run typecheck`, `npm run build` → PASS; check in a browser with two test accounts that a block hides the entry and Unblock restores it.
- [ ] **Step 5:** Commit `feat: block a cook (hides their posts from you)`.

### Task 8: Push notifications

**Files:**
- Create: `src/lib/push.ts` (pure) + `src/lib/push.test.ts`
- Create: `src/lib/push-server.ts`: `apnsJwt(now: Date): string` (ES256 via `crypto.sign`, cached 50 min), `sendApns(token: string, payload: { title: string; body: string; url: string }): Promise<"ok" | "gone" | "error">` (HTTP/2 to `api.push.apple.com`, topic `APPLE_BUNDLE_ID`), `runPushTick(now: Date): Promise<{ sent: number; pruned: number }>`
- Create: `src/app/api/push/register/route.ts` (POST `{ token, timeZone, storefront }`, signed-in only; upsert `push_devices`, bump `last_seen_at`)
- Create: `src/app/api/push/tick/route.ts` (POST, header `x-cron-secret` = `PUSH_CRON_SECRET`; calls `runPushTick`)
- Create: `supabase/migrations/0019_push_cron.sql`: `pg_cron` job every hour at :00 calling the tick URL with `pg_net` (secret stored via Supabase Vault, not in the file).
- Modify: `src/app/account/page.tsx` (app only): toggles "Daily trivia and games are ready" / "Tonight's dinner from my plan" → server action `setNotify(kind, on)` in `app/account/actions.ts`; turning one on asks for push permission and registers the token.
- Modify: `src/components/TriviaGame.tsx` (after a first finished play) and `src/app/plan/page.tsx` (after a plan exists): one-time app-only prompt "Want a ping when tomorrow's trivia is ready?" / "Want a reminder of tonight's dinner?" (dismissal remembered in `localStorage`).
- Modify: `src/lib/native.ts`: `enablePush(): Promise<boolean>` (request permission, register, POST token + `Intl.DateTimeFormat().resolvedOptions().timeZone` + storefront); push tap opens `payload.url` in the web view.

**Interfaces:**
- Consumes: `triviaDay`, `addDays` (`lib/trivia.ts`); trivia approval and play lookups (`triviaSchedule`, `triviaPlay` in `lib/trivia-server.ts`); `legacySlots`/plan slot shape (`lib/planner.ts`); `hasPlus`.
- Produces (pure):
  - `localHour(now: Date, timeZone: string | null): number` (falls back to `America/New_York` on null/invalid)
  - `localDate(now: Date, timeZone: string | null): string` (YYYY-MM-DD)
  - `dailyGamesDue(input: { now: Date; timeZone: string | null; enabled: boolean; dayApproved: boolean; playedToday: boolean; alreadySent: boolean }): boolean` (true only at local hour 9, enabled, current UTC trivia day approved, not played that UTC day, not sent for that local date)
  - `planDinnerToday(input: { now: Date; timeZone: string | null; planCreatedAt: string; days: number; slots: PlanSlot[] }): string | null` (recipe id: weekday index Mon=0 from the local date; null if plan older than 7 days, weekday index ≥ `days`, or no dinner that day)
  - `dinnerDue(input: { now: Date; timeZone: string | null; enabled: boolean; plus: boolean; recipeId: string | null; alreadySent: boolean }): boolean` (local hour 16)
  - Copy: daily games: title "Today's Yumjack trivia is ready", body "3 quick food questions. Keep your streak going.", url `/trivia`. Dinner: title "Tonight: <dish>", body "Your plan says it's <dish> for dinner. The recipe's ready.", url `/plan`.

- [ ] **Step 1: Failing tests** in `push.test.ts`, including:

```ts
test("sydney 9am on the previous UTC day: no push if already played that UTC day", () => {
  const now = new Date("2026-12-01T22:00:00Z"); // 9am Dec 2 in Sydney, UTC day Dec 1
  const base = { now, timeZone: "Australia/Sydney", enabled: true, dayApproved: true, alreadySent: false };
  assert.equal(dailyGamesDue({ ...base, playedToday: true }), false);
  assert.equal(dailyGamesDue({ ...base, playedToday: false }), true);
});
test("not approved, not enabled, wrong hour or already sent: no push", () => { /* one assert each */ });
test("bad time zone falls back to New York", () => assert.equal(localHour(new Date("2026-12-01T14:00:00Z"), "Not/AZone"), 9));
test("plan dinner by weekday label, stops after 7 days", () => {
  // plan made Wed 2026-12-02, 5 days; Thursday local → index 3 → slot for day 3 dinner
  // 8 days later → null; index >= days → null
});
test("dinner reminder needs Plus", () => { /* dinnerDue with plus:false → false */ });
```

- [ ] **Step 2:** `npm test` → FAIL. **Step 3:** Implement pure functions, then server, routes, UI. `runPushTick` records each send in `push_sends` before sending (insert-or-skip on the primary key) so a retried tick never double-sends; deletes devices on `"gone"`.
- [ ] **Step 4:** `npm test`, `npm run typecheck`, `npm run build` → PASS.
- [ ] **Step 5 (needs Task 0 + TestFlight):** turn on both toggles on Dan's phone; call the tick route by hand with the secret at a matching hour (or a temporary `?force=1` honored only for admins) and confirm both notifications arrive and open the right page. Remove any force path before commit.
- [ ] **Step 6:** Commit `feat: opt-in push for daily trivia and tonight's dinner`; Dan runs `0019_push_cron.sql`.

### Task 9: Apple purchases (RevenueCat) next to Stripe

**Files:**
- Create: `src/lib/apple-billing.ts` (pure) + `src/lib/apple-billing.test.ts`
- Create: `src/lib/apple-billing-server.ts`: `recordAppleEvent(event: RevenueCatEvent): Promise<void>`, `refreshFromRevenueCat(userId: string): Promise<boolean>` (GET `https://api.revenuecat.com/v1/subscribers/<userId>` with `REVENUECAT_SECRET_KEY`, mirrors `refreshFromStripe`)
- Create: `src/app/api/revenuecat/webhook/route.ts` (POST; reject unless `Authorization` equals `REVENUECAT_WEBHOOK_AUTH`; add to `src/proxy.ts` matcher exclusions like `api/stripe/webhook`)
- Create: `src/app/api/revenuecat/refresh/route.ts` (POST, signed-in; called after a purchase or restore and on app open)
- Create: `src/components/PlusBuyButtons.tsx` (client): uses `plusOffers(plusSource(profile), await appStorefront())`; on the website renders today's Stripe buttons unchanged; in the app renders "Subscribe with Apple" (monthly/yearly, RevenueCat `purchasePackage`), "Pay on yumjack.app" (only when `stripe` true; opens the Stripe checkout via `openExternal` to `/pricing?from=app`), the `note` when set, and "Restore purchases".
- Modify: `src/app/pricing/page.tsx` and `src/app/account/page.tsx` to use `PlusBuyButtons`; account page in the app shows "Manage in Apple" (`openExternal("https://apps.apple.com/account/subscriptions")`) for Apple subscribers and the Stripe portal for Stripe subscribers; if both are live, show "You're paying twice. Cancel one: Apple in iPhone Settings, or yumjack.app in Manage billing."
- Modify: `src/components/ChefEditor.tsx` gear shop: in the app, "Buy with Apple" for items and bundles where `appleBundleAllowed` (items always), plus the existing Stripe button when `stripeLinkAllowed`.
- Modify: `src/components/DeleteAccount.tsx`: if `apple_until` is in the future, show the warning "You're subscribed through Apple. Cancel in iPhone Settings first, or Apple will keep charging you." with the Manage in Apple link, before the delete confirm.
- Modify: `src/lib/native.ts`: `rcConfigure(userId)` (RevenueCat `configure` with public key + `appUserID = userId`, called after sign-in in the app), `rcBuy(productId)`, `rcRestore()`.
- Modify: Terms and Privacy pages: Apple purchases and refunds go through Apple; RevenueCat processes purchase records.

**Interfaces:**
- Consumes: `plusSource`, `plusOffers`, `stripeLinkAllowed`, `appleProductForGear`, `gearForAppleProduct`, `appleBundleAllowed` (Task 2); `apple_until`, `apple_status`, `apple_product`, `user_gear.source = 'apple'`, `apple_transaction_id` (Task 1); `appStorefront`, `openExternal` (Task 3).
- Produces (pure):
  - `type RevenueCatEvent = { id: string; type: string; app_user_id: string; product_id: string; expiration_at_ms: number | null; event_timestamp_ms: number; transaction_id: string | null; store: string }`
  - `type AppleChange = { kind: "plus"; apple_until: string | null; apple_status: string; apple_product: string } | { kind: "gear_grant"; target: { item: string } | { bundle: string }; transactionId: string } | { kind: "gear_revoke"; transactionId: string } | { kind: "ignore" }`
  - `applyAppleEvent(event: RevenueCatEvent, current: { apple_until: string | null }): AppleChange`: Plus products: `INITIAL_PURCHASE`, `RENEWAL`, `UNCANCELLATION`, `PRODUCT_CHANGE` → `apple_until` = expiration, but never earlier than `current.apple_until` unless the event is `EXPIRATION` or a `CANCELLATION` with `cancel_reason` refund (`REFUND` → `apple_until` = now); `CANCELLATION` (not refund) keeps `apple_until` (they paid through the period) with status `"canceled"`; `BILLING_ISSUE` keeps access until expiration (Apple grace). Gear products: `NON_RENEWING_PURCHASE` → `gear_grant`; refund `CANCELLATION` → `gear_revoke`. Unknown products or `store !== "APP_STORE"` → `ignore`. A `TRANSFER` event → `ignore` here; the server re-runs `refreshFromRevenueCat` for both user ids.
- Recording gear expands bundles to items and skips items already owned; `user_gear` rows carry `source: "apple"` and `apple_transaction_id` (unique, so replays are no-ops). Legendary/earned items can never be granted this way (`gearForAppleProduct` only knows shop items/bundles).

- [ ] **Step 1: Failing tests** in `apple-billing.test.ts`, one `test` each:
  - `RENEWAL` with expiration Jan 1 when current is Dec 1 → `apple_until` Jan 1.
  - An older `RENEWAL` (expiration Dec 1) replayed when current is Jan 1 → `apple_until` stays Jan 1.
  - `EXPIRATION` whose `expiration_at_ms` is older than current `apple_until` → `ignore` (a newer renewal already happened); `EXPIRATION` matching current → `apple_until` = its expiration, status `"expired"`.
  - `CANCELLATION` (not refund) → `apple_until` unchanged, status `"canceled"`.
  - Refund `CANCELLATION` on Plus → `apple_until` = event time.
  - `NON_RENEWING_PURCHASE` of `bundle_party_night` → `gear_grant` with `{ bundle: "party-night" }`; refund of it → `gear_revoke` with its transaction id.
  - `store: "PLAY_STORE"` or product `foo` → `ignore`.
- [ ] **Step 2:** `npm test` → FAIL. **Step 3:** Implement pure → server → routes → UI.
- [ ] **Step 4:** `npm test`, `npm run typecheck`, `npm run build` → PASS. On the website, confirm `/pricing`, `/account` and the gear shop look and work exactly as before (Stripe test mode).
- [ ] **Step 5 (needs Task 0):** create the App Store products (ids from Global Constraints, prices $9.99 / $59.99 / each gear price) in App Store Connect and RevenueCat (one "plus" entitlement + offering); point the RevenueCat webhook at `https://yumjack.app/api/revenuecat/webhook`. In TestFlight with an Apple sandbox account: buy monthly → Plus on in app and on the website; restore while signed into a second test account → Plus moves; buy a gear item → owned; sandbox refund → gone; with Stripe Plus active the Apple buttons are hidden.
- [ ] **Step 6:** Commit `feat: Apple in-app purchase for Plus and gear alongside Stripe`.

### Task 10: Going global

**Files:**
- Modify: `src/app/privacy/page.tsx`: section for EU/UK and other regions: what's collected and why, legal basis, getting a copy or deletion (point to account deletion), processors (Supabase, Vercel, Stripe, Apple, RevenueCat, Anthropic), push tokens, contact email.
- Modify: `src/app/terms/page.tsx`: Apple purchases/refunds; prices and stores are US estimates.
- Modify: `src/components/RecipeView.tsx` cart and `src/components/GroceryList.tsx`: in the app, hide the Instacart/Kroger store tabs when `groceryStoresShown(await appStorefront())` is false (the list itself stays).
- Check: the site sets only necessary cookies (grep `cookies().set` / `document.cookie`). If anything non-essential exists, note it for Dan instead of adding a banner.

- [ ] **Step 1:** Edit pages and gate the store tabs. **Step 2:** `npm run typecheck`, `npm test`, `npm run build` → PASS. **Step 3:** Commit `docs: privacy and terms for worldwide app; hide US stores outside US/Canada in app`.

### Task 11: App Store listing drafts and docs

**Files:**
- Create: `docs/app-store/listing.md`: name "Yumjack", subtitle (≤30 chars, e.g. "Copycat recipes from a photo"), promotional text, description (prices are US estimates), keywords (≤100 chars), support URL `https://yumjack.app/help` or existing contact page, privacy policy URL, age rating answers, privacy "nutrition label" answers (contact info: email, linked; user content: photos, linked; purchases, linked; identifiers: user id + push token, linked; usage data if analytics are on; nothing used for tracking), review notes (demo account to be created by Dan and typed by him into App Store Connect; how to try snap, notifications, offline list, share, both payment options, block/report), screenshot plan (6.9" and 6.5" iPhone; 5 shots: snap → recipe, cost vs. menu, grocery list, trivia/games, plan my week).
- Modify: `CLAUDE.md`: add an "iPhone app" row to "Where things live" (`mobile/`, `lib/app-shell.ts`, `lib/native.ts`, push, RevenueCat files), replace "No app-store app yet…" with the payment rules (Apple everywhere, Stripe link US-only), and add gotchas (AASA env, RevenueCat webhook outside proxy, Codemagic build, cron via Supabase).
- Modify: `mobile/README.md`: release steps for Dan.

- [ ] **Step 1:** Write the drafts and doc updates. **Step 2:** Commit `docs: App Store listing drafts and app notes`.

### Task 12: TestFlight run-through and submit

- [ ] **Step 1:** Fresh TestFlight build via Codemagic; Dan and Claude run the checklist: sign in three ways; snap a dish with the camera; share a card to Messages; plan grocery list offline in airplane mode; both notifications; block/unblock; Apple sandbox purchase, restore, refund; Stripe link visible on a US account only; delete-account warning with an Apple subscription; dark mode; safe areas on a notched phone.
- [ ] **Step 2:** Dan takes screenshots per `docs/app-store/listing.md` (or Claude prepares framed ones from simulator captures in Codemagic), fills App Store Connect from the drafts, sets availability to all countries except China mainland, attaches the IAP products to the version, and submits for review.
- [ ] **Step 3:** If Apple rejects, bring the message back; fix and resubmit.
