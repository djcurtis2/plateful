-- Plateful cook-off game: 3 votes per person per cook-off, two weekly winners
-- (Crowd favorite + Chef's pick), points, badges and prizes.
-- Run after 0001_init.sql. Safe to re-run.

-- Profiles ---------------------------------------------------------------

-- Public name shown on entries and leaderboards. Null = "A Plateful cook".
-- (display_name defaults to the email prefix, so it is never shown publicly.)
alter table public.profiles add column if not exists public_name text
  check (public_name is null or char_length(public_name) between 2 and 30);
-- Admins pick the Chef's pick, finalize cook-offs and manage prizes.
alter table public.profiles add column if not exists is_admin boolean not null default false;

grant update (display_name, public_name) on public.profiles to authenticated;

-- Challenges: winners ----------------------------------------------------

alter table public.challenges add column if not exists chef_pick_attempt_id uuid references public.attempts (id) on delete set null;
alter table public.challenges add column if not exists crowd_winner_attempt_id uuid references public.attempts (id) on delete set null;
alter table public.challenges add column if not exists finalized_at timestamptz;

-- Votes: 3 per person per cook-off, never your own, only while it's open ---

alter table public.attempt_votes add column if not exists challenge_id uuid references public.challenges (id) on delete cascade;
create index if not exists attempt_votes_user_challenge_idx on public.attempt_votes (user_id, challenge_id);

drop function if exists public.toggle_vote(uuid, uuid);

create or replace function public.cast_vote(p_attempt uuid, p_user uuid) returns json
language plpgsql security definer set search_path = public as $$
declare
  a public.attempts%rowtype;
  c public.challenges%rowtype;
  used int;
  had boolean;
  n int;
begin
  select * into a from attempts where id = p_attempt and not hidden;
  if not found then return json_build_object('ok', false, 'code', 'not_found'); end if;
  if a.user_id = p_user then return json_build_object('ok', false, 'code', 'own_entry'); end if;
  if a.challenge_id is null then return json_build_object('ok', false, 'code', 'not_in_cookoff'); end if;

  select * into c from challenges where id = a.challenge_id;
  if now() > c.ends_at or c.finalized_at is not null then
    return json_build_object('ok', false, 'code', 'closed');
  end if;

  -- Serialize this voter's votes in this cook-off so two quick clicks can't exceed 3.
  perform pg_advisory_xact_lock(hashtext(p_user::text || a.challenge_id::text));

  had := exists (select 1 from attempt_votes where attempt_id = p_attempt and user_id = p_user);
  if had then
    delete from attempt_votes where attempt_id = p_attempt and user_id = p_user;
    update attempts set votes = greatest(votes - 1, 0) where id = p_attempt returning votes into n;
  else
    select count(*) into used from attempt_votes where user_id = p_user and challenge_id = a.challenge_id;
    if used >= 3 then return json_build_object('ok', false, 'code', 'no_votes_left'); end if;
    insert into attempt_votes (attempt_id, user_id, challenge_id) values (p_attempt, p_user, a.challenge_id);
    update attempts set votes = votes + 1 where id = p_attempt returning votes into n;
  end if;

  select count(*) into used from attempt_votes where user_id = p_user and challenge_id = a.challenge_id;
  return json_build_object(
    'ok', true, 'voted', not had, 'votes', n, 'remaining', 3 - used,
    'challenge_id', a.challenge_id, 'owner_id', a.user_id
  );
end;
$$;
revoke execute on function public.cast_vote(uuid, uuid) from public, anon, authenticated;

-- Points ledger ----------------------------------------------------------
-- One row per reason, so points can be audited and never double-counted.

create table if not exists public.points_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('post', 'vote_cast', 'vote_received', 'referral_signup', 'referral_cook', 'streak', 'win', 'chef_pick', 'top10')),
  points int not null,
  ref text not null,                     -- what earned it (attempt id, voter:attempt, friend id...)
  challenge_id uuid references public.challenges (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, kind, ref)
);
create index if not exists points_events_user_idx on public.points_events (user_id);
create index if not exists points_events_challenge_idx on public.points_events (challenge_id, user_id);
alter table public.points_events enable row level security;
drop policy if exists "points: read own" on public.points_events;
create policy "points: read own" on public.points_events for select using (auth.uid() = user_id);

-- Badges -----------------------------------------------------------------

create table if not exists public.user_badges (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  badge text not null check (badge in ('first_copycat', 'top10', 'crowd_favorite', 'chef_pick', 'streak_4', 'brought_3')),
  challenge_id uuid references public.challenges (id) on delete set null,
  created_at timestamptz not null default now()
);
-- Repeatable badges (winner, top 10) once per cook-off; milestone badges once ever.
create unique index if not exists user_badges_once on public.user_badges (user_id, badge, coalesce(challenge_id, '00000000-0000-0000-0000-000000000000'::uuid));
alter table public.user_badges enable row level security;
drop policy if exists "badges: public read" on public.user_badges;
create policy "badges: public read" on public.user_badges for select using (true);

-- Prizes -----------------------------------------------------------------
-- Plus months are applied automatically; gift cards are recorded here and fulfilled by hand.

create table if not exists public.prize_awards (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('plus_months', 'gift_card', 'social_feature')),
  reason text not null,                  -- 'crowd_favorite', 'chef_pick', 'monthly_top'
  challenge_id uuid references public.challenges (id) on delete set null,
  period text,                           -- e.g. '2026-11' for monthly prizes
  detail text,                           -- '3 months', '$50 grocery gift card'
  status text not null default 'pending' check (status in ('pending', 'fulfilled', 'cancelled')),
  created_at timestamptz not null default now(),
  fulfilled_at timestamptz
);
create unique index if not exists prize_awards_once on public.prize_awards
  (user_id, kind, reason, coalesce(challenge_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(period, ''));
alter table public.prize_awards enable row level security;
drop policy if exists "prizes: read own" on public.prize_awards;
create policy "prizes: read own" on public.prize_awards for select using (auth.uid() = user_id);

-- Reports ----------------------------------------------------------------

create table if not exists public.attempt_reports (
  attempt_id uuid not null references public.attempts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  primary key (attempt_id, user_id)
);
alter table public.attempt_reports enable row level security;

-- Backfill: existing votes belong to their entry's cook-off.
update public.attempt_votes v set challenge_id = a.challenge_id
from public.attempts a where a.id = v.attempt_id and v.challenge_id is null;
