# Daily games

Short games built from Dupe Kitchen's own data (dish photos, menu prices, home costs, cooking activity).
Like the daily newspaper crossword: one puzzle a day, the same for everyone, under two minutes, with a spoiler-free result to share.

## Goals

- A reason to open Dupe Kitchen every day, not just when snapping a dish.
- Teach the core idea (restaurant price vs. home cost) while people play.
- Push toward real cooking (Cooking Bingo), which feeds savings, cook-offs and sharing.
- Every share links back to the site.

## Shared rules

- **Day** = UTC date, same as trivia (`triviaDay()`). Puzzles are picked once per day and stored in `game_days`, so adding recipes mid-day never changes today's puzzle.
- **One go per signed-in person per day** (`game_plays`, keyed by user + game + day). Guests can play but earn nothing and nothing is saved.
- **Answers stay on the server** until a guess is made (server actions check every move). Guess the Dish's photo is served through `/api/games/dish-image`, so its file name can't give the dish away.
- **Points** use kind `game` in `points_events`, idempotent per user + ref. Small on purpose: games reward the daily habit; cooking stays the main way to level up. Like trivia, game points count for levels and gear but never the monthly prize (`monthlyTop` excludes them).
- **No chance-based prizes with real value, and nothing is ever bought.** No spins, loot or paid retries.
- Moves are saved with a `moves` counter and only applied if nobody else moved in between (two tabs can't double-play).

## Guess the Dish (daily)

- A dish photo starts zoomed in and blurred. Each wrong guess zooms out and sharpens it. 6 guesses.
- Guesses are picked from a list of ~40 dish names (today's answer hidden among them), so spelling never matters.
- Hints unlock as you miss: after 2 misses the cuisine, after 3 the meal, after 4 the label (e.g. "Chipotle copycat" or "Weeknight · Dupe Kitchen original").
- Points: solved in 1–2 guesses = 3, in 3–4 = 2, in 5–6 = 1.
- Share: `Dupe Kitchen · Guess the Dish · Nov 2 / 🟥🟥🟩 3/6`.
- Pool: public recipes with a photo, not versions, one per dish name, not used in the last 30 days.

## Higher or Lower (daily run)

- Two dishes side by side. You see the first one's restaurant price per plate; guess if the next costs more or less per plate. Keep going until you miss.
- Same deck for everyone each day (up to 30 copycats with menu prices, shuffled by the day), so the daily leaderboard is fair. Ties count as right.
- Prices are per plate (`menuPlate`), the same comparison used everywhere else.
- Points: 1 per 5 in a row, up to 3. Daily top-10 leaderboard by score (earliest finish wins ties).
- Share: `Dupe Kitchen · Higher or Lower · Nov 2 / 🔥 12 in a row`.

## Cooking Bingo (weekly)

- A 3×3 card each week (Monday–Sunday UTC), the same for everyone, centre square free.
- Squares tick themselves from what you already do on Dupe Kitchen: cook a dinner, cook a copycat, a plate under $3, a vegetarian dish, two cuisines, make a version, make a leftovers recipe, post a cook-off entry, vote, play trivia 3 days, snap a dish, save $20, plan a week.
- Points: 3 per completed line, 10 for the full card. Awarded once per week each.
- Share: an emoji 3×3 grid.

## Where things live

| Part | Files |
| --- | --- |
| Pure rules | `src/lib/games.ts` (+ `games.test.ts`) |
| Server | `src/lib/games-server.ts` |
| Moves | `src/app/games/actions.ts` |
| Pages | `src/app/games/` (hub, `dish`, `higher-lower`, `bingo`) |
| Hidden photo | `src/app/api/games/dish-image/route.ts` |
| UI | `src/components/DishGuessGame.tsx`, `HigherLowerGame.tsx`, `ShareButton.tsx` |
| Database | `supabase/migrations/0014_games.sql` (`game_days`, `game_plays`, points kind `game`) |

## Later ideas

Food Connections (16 words, 4 groups), Mini Food Crossword (needs admin review like trivia), Pantry Bee, Where's It From? (map), Fridge Raid (community-voted), a free daily Spice Wheel for cosmetic rewards only.
