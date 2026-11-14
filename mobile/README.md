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

If `mobile/ios` is ever deleted, the workflow recreates it with `npx cap add ios --packagemanager SPM` and applies those settings. The icon and splash pictures would then need to be put back (see `ios/App/App/Assets.xcassets`).

To work on it locally: `cd mobile && npm install`.

## Known to-dos

- The icon is made from the 512 px website icon enlarged to 1024 px. It is two flat shapes so it stays sharp, but a proper 1024 px original would be better before App Store review.
