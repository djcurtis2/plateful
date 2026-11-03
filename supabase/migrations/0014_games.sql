-- Daily games: Guess the Dish and Higher or Lower (Cooking Bingo needs no tables: it's worked out from activity).
-- See docs/games.md. Run after 0013_trivia.sql. Safe to run more than once.

-- Each day's puzzle, picked once so it never changes mid-day. Server-only (holds the answers).
create table if not exists public.game_days (
  game text not null check (game in ('guess_dish', 'higher_lower')),
  day date not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  primary key (game, day)
);
alter table public.game_days enable row level security;

-- One play per person per game per day.
create table if not exists public.game_plays (
  user_id uuid not null references public.profiles (id) on delete cascade,
  game text not null check (game in ('guess_dish', 'higher_lower')),
  day date not null,
  picks text[] not null default '{}',     -- guesses (dish names, or 'higher'/'lower') in order
  moves smallint not null default 0,      -- guards against two tabs moving at once
  score int not null default 0,
  solved boolean not null default false,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, game, day)
);
create index if not exists game_plays_board_idx on public.game_plays (game, day, score desc);
alter table public.game_plays enable row level security;
drop policy if exists "game plays: read own" on public.game_plays;
create policy "game plays: read own" on public.game_plays for select using (auth.uid() = user_id);

-- Game points share the ledger (kind 'game'); like trivia they never count for the monthly prize.
alter table public.points_events drop constraint if exists points_events_kind_check;
alter table public.points_events add constraint points_events_kind_check
  check (kind in ('post', 'vote_cast', 'vote_received', 'referral_signup', 'referral_cook', 'streak', 'win', 'chef_pick', 'thriftiest', 'top10', 'receipt', 'trivia', 'game'));

select (select count(*) from information_schema.tables where table_schema = 'public' and table_name in ('game_days', 'game_plays')) as game_tables;
