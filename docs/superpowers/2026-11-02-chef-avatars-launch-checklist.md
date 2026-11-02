# Chef avatars — launch checklist

Things to do by hand before merging `feature/chef-avatars` to `main`.

## Supabase
- [ ] Re-run `supabase/migrations/0011_club_popular.sql` (it was edited after first draft).

## Stripe
- [ ] Add `checkout.session.async_payment_succeeded` to the "Plateful live site" webhook endpoint.
- [ ] Decide: a partly owned bundle still charges the full bundle price.

## Manual Stripe test steps for Dan

Use test mode only, with test card `4242 4242 4242 4242`, any future date, any CVC.

1. Install the Stripe CLI and run `stripe login` (once).
2. Terminal 1: `npm run stripe:listen`. Copy the `whsec_…` it prints into `.env.local` as `STRIPE_WEBHOOK_SECRET` if it changed.
3. Terminal 2: `npm run dev`, sign in, open `http://localhost:3000/chef?tab=shop`.
4. **Single item:** click Buy on "Pizza slice" → Stripe Checkout shows "Pizza slice $1.99" → pay with the test card. You land on `/chef?tab=wardrobe&bought=cs_test_…` with the thanks line, and Pizza slice is wearable (no longer "$1.99" in the Wardrobe). Terminal 1 shows `checkout.session.completed` → `[200]`.
5. **Exactly one row:** in the Supabase SQL editor run `select * from user_gear where user_id = '<your id>';` → one `pizza-slice` row, `source = shop`, `stripe_session_id = cs_test_…`.
6. **Replay safety:** reload the success URL (same `bought=`), and run `stripe events resend <evt_id>` (the event id is in Terminal 1 or Stripe Dashboard → Developers → Events). Re-run the SQL: still exactly one row. The webhook still answers 200.
7. **Owned item:** back on the Shop tab, Pizza slice says "Owned" and has no Buy.
8. **Bundle with one owned item:** buy Cat ears alone first, then the Shop tab shows "Party night" with "(you get the 2 you don't have)". Buy it → Checkout charges **$3.99** (the full bundle price) → afterwards `user_gear` has `disco-floor` and `tuxedo` added, still only one `cat-ears` row, and Party night disappears from the shop.
9. **Webhook missed:** stop `stripe:listen`, buy another item, and land on the success page. The item is still unlocked (the success-page check). Restart listen later: the late event adds nothing new.
10. **Foreign session:** while signed in as a second test user, open `/chef?bought=<first user's cs_test_ id>` → nothing is recorded for the second user (the "give it a minute" line shows).
11. **Admin:** on `/admin` → Gear, paste your user id, pick an item → Grant (row with `source = grant`). Equip it and save your chef, then Remove → Confirm. The row is gone, and `profiles.avatar.equipped.<slot>` is now the starter (e.g. `paper-hat`). The leaderboard shows the starter.
12. **Live site (before taking real money):** the "Plateful live site" webhook endpoint in the Stripe Dashboard must include `checkout.session.completed` (it already does for Plus, so just confirm).


## Browser checks (signed in)

### My chef page
1. /chef first visit: Look tab, nudge line, random chef; change a part, Save; reload: sticks.
2. Wardrobe: starters wearable; level/points/badge/Plus/shop items greyed with reason (e.g. "Reach Sous chef", "Plus", "$1.99"). Equip one, Save, reload.
3. Click tabs: preview edits persist between tabs; /chef?tab=shop opens Shop placeholder.
4. Clubs: third checkbox is disabled; Save; account page shows the two names. (Server also trims to 2 via devtools call.)
5. Free account calling saveChef with a Plus item (devtools): refused "That gear is locked.", nothing saved.
6. Header shows head chef linking to /chef; account page shows big chef; light + dark rarity borders readable.

7. Wardrobe and Shop: each slot has a None tile; tiles show your chef wearing the item; clicking a locked or shop item previews it without saving.

### Header
1. No chef saved yet: a dot on the header chef. Save once: the dot goes.
2. Reach a new level or badge: one gear celebration per page load, never for the level-0 starter.

### Boards and share card
1. Leaderboard (all three views): chef heads and club badges beside names; "you" row still highlighted.
2. Cook-off board, a past cook-off's winners and an entry page show chef + clubs.
3. "Get votes" on your entry: the share card PNG shows your full chef bottom right, not overlapping the saved bar or link text; Save my card works.
4. Change chef gear on /chef, reload board: the new look shows.


### Clubs and admin
1. /clubs lists all clubs; /clubs/<id> shows popular recipes once 3+ members cooked or saved them; private recipes never show; unknown id → 404.
2. /admin/avatars art sheet: every gear item draws, in light and dark mode.
