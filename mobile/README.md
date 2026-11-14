# Yumjack iPhone app

The app is a thin frame around the live website. Think of it like a picture frame: the frame (the app) is built once, and the picture inside (yumjack.app) changes whenever the website is updated, so most site changes reach phones without a new App Store release.

You do not need a Mac. A cloud service called Codemagic has the Macs and builds the app for you.

## What is in this folder

- `capacitor.config.ts`: app name, bundle id `app.yumjack.ios`, and the address it loads.
- `ios/`: the Xcode project (camera and photo messages, `applinks:yumjack.app` link permission, icon, splash).
- `www/`: the "no connection" page shown when the phone is offline.
- `../codemagic.yaml`: the build recipe Codemagic follows.

## One-time setup (you do this)

1. **Apple Developer account** (paid) with an App Store Connect app record for bundle id `app.yumjack.ios` named Yumjack.
2. **App Store Connect API key**: in App Store Connect, Users and Access, Integrations, create a key with "App Manager" access. Download the `.p8` file once (keep it private; never put it in this repo).
3. **Codemagic**: sign in at codemagic.io with GitHub and add the plateful repo. Under Teams, Integrations, App Store Connect, add the key and name the integration exactly `yumjack_asc`.
4. **Turn on four App ID capabilities, once**: in Apple Developer, Certificates, Identifiers, open `app.yumjack.ios`, tick **Associated Domains**, **Push Notifications**, **Sign in with Apple** and **In-App Purchase**, then Save. Associated Domains is needed for the first build (the app asks for it, and signing fails without it); the other three are needed by later features, and doing them now means you only visit this page once.
5. **Vercel settings** so tapped links open the app. In Vercel, add two environment variables to the Yumjack project and redeploy:
   - `APPLE_TEAM_ID`: your 10-character Team ID (Apple Developer, Membership).
   - `APPLE_BUNDLE_ID`: `app.yumjack.ios`
   Then open `https://yumjack.app/.well-known/apple-app-site-association`. You should see a short block of text that includes your Team ID.

## Start a build

1. In Codemagic open the Yumjack app, press **Start new build**.
2. Pick the branch and the workflow **ios-testflight**, then **Start new build**.
3. It takes about 10 to 15 minutes. It installs the app pieces, signs the app automatically, builds it and sends it to TestFlight.

If it fails, open the red step and send me the last lines of the log.

## Install it from TestFlight

1. Install the free **TestFlight** app on your iPhone.
2. In App Store Connect, open the app, TestFlight tab, and add yourself as an internal tester (your Apple ID email).
3. After the build finishes processing (a few minutes after Codemagic says done), you get an email and a push to TestFlight. Tap **Install**.
4. Check: the app opens yumjack.app; turn on airplane mode and reopen to see the offline page; tap a yumjack.app link in Notes and it should open in the app.

## How the project was made (for later changes)

Capacitor 7 with Swift Package Manager (no CocoaPods). It was generated on Windows with `npx cap add ios --packagemanager SPM`. That command makes the project fine but then stumbles on its last CocoaPods step on Windows, which is harmless. Codemagic runs `npx cap sync ios` on every build, which refreshes the plugin list and web files.

The settings Apple needs are committed in the project and re-checked in CI by the "Check the app settings Apple needs" step (using PlistBuddy, which sets them if missing):

- `NSCameraUsageDescription` and `NSPhotoLibraryUsageDescription`
- `ITSAppUsesNonExemptEncryption = false`
- Associated Domains entitlement `applinks:yumjack.app` (`ios/App/App/App.entitlements`)
- Sign in with Apple entitlement and `aps-environment = production` (push notifications). Push also needs **Push Notifications** ticked on the App ID (step 4 above); without it the app can't get a push token and the notification toggles say "Couldn't turn on notifications".

If `mobile/ios` is ever deleted, the workflow recreates it with `npx cap add ios --packagemanager SPM` and applies those settings. The icon and splash pictures would then need to be put back (see `ios/App/App/Assets.xcassets`).

To work on it locally: `cd mobile && npm install`.

## Supabase settings

Sign-in in the app needs four changes in the Supabase dashboard (Authentication). Think of it like updating the guest list at a door: Supabase only lets people back in through addresses it knows.

**Order matters:** The Apple buttons (Continue with Apple, Connect Apple) stay hidden until `NEXT_PUBLIC_APPLE_SIGNIN=1` is set in Vercel. Turn on the Apple provider and manual linking first, then set that flag and redeploy. Change the email templates only AFTER the new code is deployed.

1. **Email links go straight to Yumjack.** Authentication, Emails (Templates). In both **Magic Link** and **Confirm signup**, replace the link (usually `{{ .ConfirmationURL }}`) with:

   ```html
   <a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email">Sign in to Yumjack</a>
   ```

   `{{ .RedirectTo }}` is the `https://yumjack.app/auth/callback?next=…` address the sign-in form sends, so the link opens yumjack.app directly (and the app, on an iPhone). It works on any device or browser, not only the one the link was asked from. Old emails sent before the change still work.
2. **Redirect allow-list.** Authentication, URL Configuration, Redirect URLs: add `app.yumjack.ios://auth/callback**` (Google sign-in in the app comes back on the app's own link). Keep the existing yumjack.app entries (they must allow `https://yumjack.app/auth/callback?next=…`; if an address is not allowed, Supabase falls back to the Site URL and the email link breaks).
3. **Apple provider.** Authentication, Sign In / Providers, Apple: turn it on. Under "Client IDs" list both `app.yumjack.ios` (the app) and the Services ID used for the website. The website also needs the Services ID, Team ID, key ID and Sign in with Apple key filled in.
4. **Manual linking.** Authentication, Sign In / Providers (or Auth settings): turn on **Allow manual linking**, so "Connect Apple" on the account page works.

Apple's "Hide my email" addresses only receive Yumjack emails once the sending domain is registered in Apple Developer, Certificates, Identifiers, Services, "Sign in with Apple for Email Communication".

## Release steps (App Store)

Do these in order. Anything marked **before deploy** must be done before the new website code goes live, or the site will error.

### 1. Database (before merging to `main`)

Vercel deploys every push to `main`, so run these **before** merging this branch. 0018 only adds things and is safe with today's live code. In the Supabase SQL editor run `supabase/migrations/0018_mobile_app.sql`, then `0019_push_cron.sql`. Before 0019, add its two Vault secrets (the exact lines are in the file header): `push_tick_url` = `https://yumjack.app/api/push/tick` and `push_cron_secret` = the same value as `PUSH_CRON_SECRET` below.

### 2. Vercel environment variables (then redeploy)

| Name | What it is |
| --- | --- |
| `APPLE_TEAM_ID`, `APPLE_BUNDLE_ID` | Team ID and `app.yumjack.ios` (links open the app) |
| `PUSH_CRON_SECRET` | A long random string you make up; also stored in Supabase Vault |
| `APNS_KEY_P8` | Full text of the Apple Push key file (`.p8`) |
| `APNS_KEY_ID` | Key ID of that push key |
| `APNS_HOST` | Optional. Leave unset for the live Apple server |
| `NEXT_PUBLIC_REVENUECAT_IOS_KEY` | RevenueCat public iOS key (baked in at build, so redeploy after setting) |
| `REVENUECAT_WEBHOOK_AUTH` | A long random string you make up; same value goes in RevenueCat's webhook |
| `REVENUECAT_SECRET_KEY` | RevenueCat secret API key (server only) |
| `NEXT_PUBLIC_APPLE_SIGNIN` | Set to `1` only after the Supabase Apple provider works (see Supabase settings), then redeploy. Until then the Apple buttons are hidden on the website and in the app. It must be on before TestFlight and review: Apple requires Sign in with Apple when Google sign-in is offered |

Create the push key in Apple Developer, Keys, with Apple Push Notifications on. Never put the `.p8` in the repo.

### 3. App Store Connect products

Create one subscription group with two subscriptions, `yumjack_plus_monthly` ($9.99) and `yumjack_plus_yearly` ($59.99). Create each shop gear item and bundle as a non-consumable at its shop price, with id `gear_<item id>` or `bundle_<bundle id>`, using `_` where the id has `-` (so `pizza-slice` becomes `gear_pizza_slice`). The items and prices are in `src/lib/avatar.ts`. Join the Small Business Program, then finish agreements, tax and banking.

### 4. RevenueCat

Add the app (bundle id `app.yumjack.ios`) and the App Store Connect in-app purchase key. Import the products above, make an entitlement whose identifier is exactly `plus` (lowercase; the site looks for that name) attached to both Plus products, and an offering holding the two Plus packages, copy the public iOS key into Vercel, and add the webhook: URL `https://yumjack.app/api/revenuecat/webhook` with the Authorization header set to the same value as `REVENUECAT_WEBHOOK_AUTH`. Set it to transfer purchases when the same Apple ID signs into a different account.

### 5. Build and test on your iPhone

Start a Codemagic build (see "Start a build"), install from TestFlight, and check: snap with the camera, share sheet, offline grocery list, notification toggles, Continue with Apple, a sandbox Plus purchase (add a sandbox tester in App Store Connect, Users and Access, Sandbox), and Block this cook. A sandbox purchase gives that account real Plus on the live database, so use a test account.

### 6. Listing and submit

Fill in the listing from `docs/app-store/listing.md` (text, privacy answers, age rating, review notes, screenshots). The reviewer signs in with Continue with Apple (a fresh account) and buys Plus with their sandbox account; if Apple asks for a demo account, give them an email address you can sign in with. Attach the processed TestFlight build and submit for review. The reviewer can buy with a sandbox account, and the US-only Stripe link follows Apple's US link-out rule; both are explained in the review notes.

### After approval

Choose manual or automatic release. Marketing links can go to the App Store page. Website changes keep reaching the app without a new release; only changes inside `mobile/` need a new build and review.

## Known to-dos

- The icon is made from the 512 px website icon enlarged to 1024 px. It is two flat shapes so it stays sharp, but a proper 1024 px original would be better before App Store review.
