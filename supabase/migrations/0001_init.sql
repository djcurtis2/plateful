-- Plateful schema. Run in the Supabase SQL editor, or with `supabase db push`.
-- Server code writes most tables with the service-role key; RLS below governs what
-- signed-in users can read and write directly from the browser.

create extension if not exists pgcrypto with schema extensions;

-- Profiles ---------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  referral_code text not null unique,
  referred_by uuid references public.profiles (id) on delete set null,
  plan text not null default 'free' check (plan in ('free', 'plus')),
  stripe_customer_id text unique,
  subscription_status text,
  current_period_end timestamptz,
  -- Free Plus time earned through referrals; Plus is active while now() < bonus_until
  bonus_until timestamptz,
  -- How many referral rewards (one per REFERRAL_GOAL cooks) have been granted so far
  referral_rewards_granted int not null default 0,
  created_at timestamptz not null default now()
);

-- pgcrypto lives in the "extensions" schema on Supabase, so name it explicitly.
create or replace function public.random_referral_code() returns text
language sql volatile set search_path = public, extensions as $$
  select 'PLATE-' || upper(substr(translate(encode(extensions.gen_random_bytes(6), 'base64'), '+/=0O1Il', ''), 1, 6));
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  code text;
begin
  loop
    code := public.random_referral_code();
    exit when not exists (select 1 from public.profiles where referral_code = code);
  end loop;
  insert into public.profiles (id, display_name, referral_code)
  values (new.id, split_part(new.email, '@', 1), code);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
create policy "profiles: read own" on public.profiles for select using (auth.uid() = id);
create policy "profiles: update own name" on public.profiles for update using (auth.uid() = id)
  with check (auth.uid() = id);
-- Plan, Stripe and referral columns are only written by the server (service role).
revoke update on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;

-- Recipes ----------------------------------------------------------------

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  user_id uuid references public.profiles (id) on delete set null,
  visitor_id uuid,
  dish text not null,
  restaurant text,
  cuisine text,
  servings int not null default 2 check (servings between 1 and 24),
  minutes int,
  difficulty text,
  confidence real,
  why text,
  menu_price numeric(8, 2),
  plate_cost numeric(8, 2),
  ingredients jsonb not null,
  steps jsonb not null,
  image_path text,
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);
create index recipes_user_idx on public.recipes (user_id, created_at desc);
create index recipes_restaurant_idx on public.recipes (lower(restaurant));

alter table public.recipes enable row level security;
create policy "recipes: public read" on public.recipes for select using (is_public or auth.uid() = user_id);

create table public.saved_recipes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  cooked_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, recipe_id)
);
alter table public.saved_recipes enable row level security;
create policy "saved: own rows" on public.saved_recipes for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Pantry -----------------------------------------------------------------

create table public.pantry_items (
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, name)
);
alter table public.pantry_items enable row level security;
create policy "pantry: own rows" on public.pantry_items for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Cook-offs --------------------------------------------------------------

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  blurb text,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
alter table public.challenges enable row level security;
create policy "challenges: public read" on public.challenges for select using (true);

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  challenge_id uuid references public.challenges (id) on delete set null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  image_path text not null,
  caption text check (char_length(caption) <= 200),
  votes int not null default 0,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index attempts_challenge_idx on public.attempts (challenge_id, votes desc);
create index attempts_recipe_idx on public.attempts (recipe_id, created_at desc);
-- One visible entry per person per recipe; posting again replaces it.
create unique index attempts_one_per_user on public.attempts (recipe_id, user_id) where not hidden;
alter table public.attempts enable row level security;
create policy "attempts: public read" on public.attempts for select using (not hidden);

create table public.attempt_votes (
  attempt_id uuid not null references public.attempts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (attempt_id, user_id)
);
alter table public.attempt_votes enable row level security;
create policy "votes: read own" on public.attempt_votes for select using (auth.uid() = user_id);

-- Referrals and waitlist -------------------------------------------------

create table public.referral_events (
  id bigint generated always as identity primary key,
  referrer_id uuid not null references public.profiles (id) on delete cascade,
  referred_user_id uuid references public.profiles (id) on delete cascade,
  visitor_id uuid,
  kind text not null check (kind in ('visit', 'signup', 'cook')),
  recipe_id uuid references public.recipes (id) on delete set null,
  created_at timestamptz not null default now()
);
create index referral_events_referrer_idx on public.referral_events (referrer_id, kind);
-- One reward-counting "cook" per referred person per referrer
create unique index referral_events_one_cook on public.referral_events (referrer_id, referred_user_id)
  where kind = 'cook';
alter table public.referral_events enable row level security;
create policy "referrals: read own" on public.referral_events for select using (auth.uid() = referrer_id);

create table public.waitlist (
  id bigint generated always as identity primary key,
  email text not null unique,
  referred_by_code text,
  source text,
  created_at timestamptz not null default now()
);
alter table public.waitlist enable row level security;
-- no policies: server only

-- Usage / cost control ---------------------------------------------------

create table public.scans (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles (id) on delete set null,
  visitor_id uuid,
  ip_hash text,
  ok boolean not null default true,
  input_tokens int,
  output_tokens int,
  created_at timestamptz not null default now()
);
create index scans_visitor_idx on public.scans (visitor_id, created_at desc);
create index scans_user_idx on public.scans (user_id, created_at desc);
create index scans_ip_idx on public.scans (ip_hash, created_at desc);
create index scans_day_idx on public.scans (created_at);
alter table public.scans enable row level security;
-- no policies: server only

-- Atomic vote toggle so counts stay consistent
create or replace function public.toggle_vote(p_attempt uuid, p_user uuid) returns int
language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  if exists (select 1 from attempt_votes where attempt_id = p_attempt and user_id = p_user) then
    delete from attempt_votes where attempt_id = p_attempt and user_id = p_user;
    update attempts set votes = greatest(votes - 1, 0) where id = p_attempt returning votes into n;
  else
    insert into attempt_votes (attempt_id, user_id) values (p_attempt, p_user);
    update attempts set votes = votes + 1 where id = p_attempt returning votes into n;
  end if;
  return n;
end;
$$;
revoke execute on function public.toggle_vote(uuid, uuid) from public, anon, authenticated;

-- Storage ----------------------------------------------------------------
-- Public buckets: dish photos (from scans) and cook-off attempt photos.
-- Uploads go through the server with the service-role key, so no insert policies are needed.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('dishes', 'dishes', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('attempts', 'attempts', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
