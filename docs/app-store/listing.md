# Yumjack App Store listing (drafts)

Drafts for Dan to paste into App Store Connect. Nothing here is submitted. Items marked **Dan** need you.

## Basics

| Field | Value |
| --- | --- |
| Name | Yumjack |
| Subtitle (max 30) | Copycat recipes from a photo |
| Bundle id | `app.yumjack.ios` |
| Primary category | Food & Drink |
| Secondary category | Lifestyle (optional) |
| Countries | All except mainland China |
| Price | Free (Plus is an in-app subscription) |
| Support URL | https://yumjack.app/terms (no `/help` page exists yet; the Terms page ends with a contact line, so it works as the support page. If you add a real help page later, swap it in.) |
| Privacy policy URL | https://yumjack.app/privacy |
| Marketing URL (optional) | https://yumjack.app |
| Copyright | 2026 and your legal name (**Dan**: use the name on your developer account) |

## Promotional text (max 170)

Snap a restaurant dish and get a copycat recipe, what it costs per plate compared with the menu, and a grocery list. Play a daily trivia round too.

## Keywords (max 100, no spaces after commas)

copycat,recipe,restaurant,grocery list,meal plan,cost per plate,cooking,dinner,trivia,savings

## Description (max 4000)

Love a dish you had at a restaurant? Snap a photo and Yumjack works out a copycat recipe you can make at home, then shows what it costs per plate compared with the menu price.

SNAP IT
Take a photo of a dish, or pick one from your photos. Yumjack reads the dish and writes a full recipe: ingredients, steps, and an honest cost per plate.

SEE WHAT YOU SAVE
Every recipe shows the restaurant price per plate next to your cost to make it. When you cook it, Yumjack adds it to your savings. These are estimates, and they are labeled that way.

GROCERY LIST THAT WORKS WITHOUT SIGNAL
One tap turns a recipe into a grocery list. Check items off as you shop. Your saved lists stay on your phone, so they still work in the store when the signal drops.

USE IT UP
Tell Yumjack what is left in your fridge and get recipe ideas that use it.

PLAN MY WEEK (PLUS)
Pick breakfast, lunch, dinner and snacks for 3 to 7 days, or let Yumjack plan it for you. It adds up the week's grocery bill, plans leftovers, and can remind you about tonight's dinner.

YOUR OWN RECIPES
Add your own recipes and Yumjack prices them for you. They stay private unless you share a link.

BUILD A PLATE
Pick a protein, a cooking method and a flavor, and Yumjack writes a recipe from your choices.

COOK-OFFS, TRIVIA AND GAMES
Post your version of a dish and vote on other cooks' plates. Play a daily trivia round, Guess the Dish, Higher or Lower and weekly Bingo. Earn points, levels and chef avatar gear.

DIETS
Set your diet once and filter recipes to match, or make a version of any recipe that fits. Diet tags are a guide, not an allergy guarantee.

NOTIFICATIONS, ONLY IF YOU WANT THEM
Turn on a daily reminder when the games are ready, or a reminder about tonight's dinner. They are off until you choose them, with no marketing messages.

PLUS
Yumjack is free to use with limited scans each week. Yumjack Plus unlocks all recipe ideas, many more new recipes and versions a day, and Plan my week.
Plus is $9.99 a month or $59.99 a year in the US. Other countries get Apple's local price. Payment is charged to your Apple ID. The subscription renews automatically unless you cancel at least 24 hours before the period ends. Manage or cancel in your iPhone Settings, under your name, then Subscriptions. You can also buy chef avatar gear in the shop.

Prices, menu prices and grocery costs are US dollar estimates and will differ by store and place. Yumjack is in English.

Terms: https://yumjack.app/terms
Privacy: https://yumjack.app/privacy

## What's New (first release)

Welcome to Yumjack on iPhone. Snap a dish, get a copycat recipe, and see what you save.

## Age rating answers

Answer Apple's questionnaire like this (expected result: 4+, or a little higher if Apple counts user-shared photos; either is fine):

- Cartoon or fantasy violence, realistic violence, sexual content, nudity, profanity, horror, alcohol/tobacco/drug references: **None**.
- Medical or treatment information: **None** (diet tags are labeled a guide, not medical advice).
- Gambling and contests: **None**. Cook-offs are a community vote with points and monthly prizes decided by votes and judging, not chance, and nothing is paid to enter.
- Unrestricted web access: **No** (the app only loads yumjack.app; other links open in a browser sheet).
- User-generated content: **Yes**, with reporting and blocking (see review notes).
- Made for kids: **No**. There are no clubs aimed at kids.

## Privacy "nutrition label" answers

Nothing is used for tracking. Answer "No" to tracking everywhere and do not add an App Tracking Transparency prompt.

| Apple category | Collected? | Linked to the user? | Used for tracking? | Why |
| --- | --- | --- | --- | --- |
| Contact info: Email address | Yes | Yes | No | Sign-in and account (Apple "hide my email" relay addresses count too) |
| User content: Photos | Yes | Yes | No | Dish photos sent for recipes, cook-off posts, attempt photos. Receipts are read once and never stored |
| User content: Other user content | Yes | Yes | No | Own recipes, cook-off posts, votes |
| Purchases: Purchase history | Yes | Yes | No | Plus and gear purchases (Apple via RevenueCat, or Stripe on the website) |
| Identifiers: User ID | Yes | Yes | No | Account id; also the RevenueCat App User ID |
| Identifiers: Device ID | Yes | Yes | No | The push notification token, only if the cook turns notifications on |
| Usage data: Product interaction | Yes | **No** | No | Vercel Web Analytics page counts |
| Location | No | | | Only the phone's time zone is stored, for notification times; that is not location |
| Diagnostics | No | | | Nothing collects crash reports |
| Everything else (health, financial info, contacts, browsing history, search history, sensitive info) | No | | | |

Analytics finding: the site does have analytics. `src/app/layout.tsx` loads Vercel Web Analytics, which the code comment and the privacy page describe as cookie-free with no personal data. So the label includes "Usage data: Product interaction", marked **not linked** and **not tracking**. If analytics is ever removed, delete that row.

## Review notes (paste into App Store Connect, "Notes")

Yumjack turns a photo of a restaurant dish into a copycat recipe with a cost per plate. The app is a native frame around our live site plus phone features: camera capture, native share sheet, push notifications, an offline grocery list, Sign in with Apple, and Apple in-app purchases.

DEMO ACCOUNT: **Dan: create one and type its email and how to sign in here.** Sign in with Apple and Google are also offered. If you use email, tap the magic link in the email (it opens in the app). Please keep the demo account signed up and Plus-enabled during review.

HOW TO TRY EACH PART
1. Snap: on the home screen tap the snap button, allow the camera, photograph any dish or choose a photo. A recipe appears with ingredients, steps, cost per plate and the restaurant price per plate. Scans are limited per account; the demo account has Plus so it has plenty.
2. Notifications: open Account and switch on "Daily games" or "Tonight's dinner", then allow the iOS prompt. They are off until chosen, at most one of each kind a day, and there are no marketing messages.
3. Offline grocery list: open any recipe and open its grocery list, then tick an item. Turn on airplane mode and reopen the app: an offline screen shows the saved lists with working check-offs.
4. Share: on a recipe tap Share to see the iPhone share sheet.
5. Payments, two ways (see below).
6. Report and block: on a cook-off entry or attempt photo from another cook, use "Report" to report it, or "Block this cook" to hide that person's posts and name from your own view. Blocks are private. Account deletion is in Account.

PAYMENTS
- "Pay with Apple" (Apple in-app purchase) shows for Yumjack Plus (monthly and yearly) and for chef avatar gear in the shop, in every country. You can test it with a sandbox Apple account. A sandbox purchase gives the account real Plus or gear in our system, which is what lets you see Plus features such as Plan my week.
- "Pay on yumjack.app" (our Stripe checkout) shows only when the App Store storefront is the United States. This follows the 2025 US court ruling in Epic v. Apple and App Review Guideline 3.1.1(a), the US exception for links to outside purchase options. It does not show in any other storefront.
- Plus bought either way works in the app and on the website on the same account. If someone already has Plus through one route, the other buy button is replaced by a note.
- Gear is cosmetic chef avatar items. Nothing is gambled or random.

OTHER
- Notification text never contains trivia answers.
- Diet tags are labeled as a guide, not an allergy guarantee.
- No third-party advertising and no tracking.

## Screenshot plan

Sizes to upload: 6.9" iPhone (1320 x 2868) and 6.5" iPhone (1284 x 2778). Apple scales these for smaller phones. Take them from a TestFlight build on a real phone (or the simulator) with the demo account, using home-style dishes with no visible brand logos and no real restaurant names.

| # | Screen | Caption idea |
| --- | --- | --- |
| 1 | Snap a dish, then the finished recipe | Snap a dish. Get the recipe. |
| 2 | Recipe cost block: cost per plate vs. menu price, savings | See what you save per plate |
| 3 | Grocery list with some items ticked | Your grocery list, even offline |
| 4 | Daily trivia and games | Play daily trivia and games |
| 5 | Plan my week grid with the weekly bill | Plan your week and your budget |

Keep captions short and big. Same order on both sizes.

## Dan's checklist before submitting

1. Create the demo account and put its details in the review notes.
2. Create the in-app products with the exact ids listed in `mobile/README.md` (Release steps) and fill in each product's review screenshot and description.
3. Fill in the privacy answers above, age rating, support and privacy URLs.
4. Join the Apple Small Business Program; finish agreements, tax and banking.
5. Upload the screenshots, attach a processed TestFlight build, press Submit.
