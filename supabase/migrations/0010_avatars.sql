-- Chef avatars: each person's look, seen-gear marker, clubs, and gear they own.
-- Run after 0009_diets.sql. Safe to re-run.

alter table public.profiles add column if not exists avatar jsonb;
alter table public.profiles add column if not exists gear_seen text[] not null default '{}';
alter table public.profiles add column if not exists clubs text[] not null default '{}';
alter table public.profiles drop constraint if exists profiles_clubs_check;
alter table public.profiles add constraint profiles_clubs_check check (cardinality(clubs) <= 2);

-- Gear a person owns (bought in the shop or granted). Written only by the server (service role).
create table if not exists public.user_gear (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  item_id text not null,
  source text not null check (source in ('shop', 'grant')),
  stripe_session_id text,
  created_at timestamptz not null default now(),
  unique (user_id, item_id)
);

alter table public.user_gear enable row level security;
drop policy if exists "user_gear_select_own" on public.user_gear;
create policy "user_gear_select_own" on public.user_gear for select using (user_id = auth.uid());

select
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name in ('avatar', 'gear_seen', 'clubs')) as new_profile_cols,
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'user_gear') as user_gear_table;
