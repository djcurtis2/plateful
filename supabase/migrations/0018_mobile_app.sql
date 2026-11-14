-- iPhone app: Apple purchases, push notifications and blocking.
-- Run after 0017_cancel_at.sql. Safe to re-run.

-- Apple subscription state lives beside (never replaces) the Stripe columns.
alter table public.profiles add column if not exists apple_until timestamptz;
alter table public.profiles add column if not exists apple_status text;
alter table public.profiles add column if not exists apple_product text;
alter table public.profiles add column if not exists notify jsonb not null default '{}';

-- Gear can now also come from an Apple purchase.
alter table public.user_gear drop constraint if exists user_gear_source_check;
alter table public.user_gear add constraint user_gear_source_check check (source in ('shop', 'grant', 'apple'));
alter table public.user_gear add column if not exists apple_transaction_id text;
create unique index if not exists user_gear_apple_transaction_id_key
  on public.user_gear (apple_transaction_id) where apple_transaction_id is not null;

-- Phones that can get notifications. Written only by the server (service role).
create table if not exists public.push_devices (
  id bigserial primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  time_zone text,
  storefront text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists push_devices_user_id_idx on public.push_devices (user_id);
alter table public.push_devices enable row level security;

-- One notification of each kind per person per local day.
create table if not exists public.push_sends (
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('daily_games', 'plan_dinner')),
  day date not null,
  primary key (user_id, kind, day)
);
alter table public.push_sends enable row level security;

-- Cooks a person has blocked.
create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.blocks enable row level security;
drop policy if exists "blocks_select_own" on public.blocks;
create policy "blocks_select_own" on public.blocks for select using (blocker_id = auth.uid());
drop policy if exists "blocks_insert_own" on public.blocks;
create policy "blocks_insert_own" on public.blocks for insert with check (blocker_id = auth.uid());
drop policy if exists "blocks_delete_own" on public.blocks;
create policy "blocks_delete_own" on public.blocks for delete using (blocker_id = auth.uid());

select
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name in ('apple_until', 'apple_status', 'apple_product', 'notify')) as new_profile_cols,
  (select count(*) from information_schema.tables
    where table_schema = 'public' and table_name in ('push_devices', 'push_sends', 'blocks')) as new_tables;
