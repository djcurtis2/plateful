-- Daily cooking trivia: three questions a day, the same for everyone.
-- Claude drafts a week at a time; an admin approves each day before it goes live.
-- Safe to run more than once.

create table if not exists public.trivia_questions (
  id bigint generated always as identity primary key,
  day date not null,                     -- the UTC day it's played
  position smallint not null check (position between 1 and 3),
  question text not null,
  choices text[] not null check (cardinality(choices) = 4),
  answer smallint not null check (answer between 0 and 3),  -- index into choices
  why text not null,                     -- one line shown after answering
  status text not null default 'draft' check (status in ('draft', 'approved')),
  created_at timestamptz not null default now(),
  unique (day, position)
);
-- Read on the server only (answers must never reach the browser early), so no public policies.
alter table public.trivia_questions enable row level security;

create table if not exists public.trivia_plays (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  picks smallint[] not null default '{}',  -- the choice picked for each question, in order
  correct smallint not null default 0,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.trivia_plays enable row level security;
drop policy if exists "trivia plays: read own" on public.trivia_plays;
create policy "trivia plays: read own" on public.trivia_plays for select using (auth.uid() = user_id);

-- Trivia points go in the same ledger as everything else.
alter table public.points_events drop constraint if exists points_events_kind_check;
alter table public.points_events add constraint points_events_kind_check
  check (kind in ('post', 'vote_cast', 'vote_received', 'referral_signup', 'referral_cook', 'streak', 'win', 'chef_pick', 'thriftiest', 'top10', 'receipt', 'trivia'));
