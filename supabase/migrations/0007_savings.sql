-- Savings tracking: every time someone actually cooks, log what eating it out would have cost.
-- Run after 0006_meal_plans.sql. Safe to re-run.

-- For recipes that aren't restaurant copycats: a typical US takeout price per plate for a comparable dish
-- (estimated by Claude), so "vs. similar takeout" stays close in price to the real thing.
alter table public.recipes add column if not exists out_price numeric(6, 2) check (out_price is null or out_price between 0 and 500);

create table if not exists public.cook_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  servings int not null check (servings between 1 and 8),
  home_cost numeric(8, 2) not null,     -- what the plates cost at home
  out_cost numeric(8, 2) not null,      -- what the same plates cost eating out
  saved numeric(8, 2) not null,         -- out_cost - home_cost, never negative
  compare text not null check (compare in ('menu', 'similar', 'average')), -- what out_cost is based on
  source text not null check (source in ('made_it', 'plan', 'cookoff')),
  verified boolean not null default false, -- backed by a cook-off photo or a receipt
  cooked_on date not null default current_date,
  created_at timestamptz not null default now(),
  unique (user_id, recipe_id, cooked_on)  -- one count per recipe per day
);
create index if not exists cook_log_user_idx on public.cook_log (user_id, cooked_on desc);
create index if not exists cook_log_date_idx on public.cook_log (cooked_on);
alter table public.cook_log enable row level security;
drop policy if exists "cook log: read own" on public.cook_log;
create policy "cook log: read own" on public.cook_log for select using (auth.uid() = user_id);

-- Opt-in to being named in Plateful stories and ads ("Dan has saved $1,240").
alter table public.profiles add column if not exists feature_me boolean not null default false;

-- Site-wide total for the home page counter (no names).
create or replace function public.savings_total() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('saved', coalesce(sum(saved), 0), 'meals', count(*), 'cooks', count(distinct user_id)) from public.cook_log;
$$;
revoke all on function public.savings_total() from public, anon, authenticated;

-- Top savers since a date (for the leaderboard and the monthly prize).
create or replace function public.top_savers(p_since date, p_limit int, p_until date default null) returns table (user_id uuid, saved numeric, meals bigint)
language sql stable security definer set search_path = public as $$
  select user_id, sum(saved) as saved, count(*) as meals
  from public.cook_log where cooked_on >= p_since and (p_until is null or cooked_on < p_until)
  group by user_id order by sum(saved) desc limit greatest(1, least(p_limit, 100));
$$;
revoke all on function public.top_savers(date, int, date) from public, anon, authenticated;

-- One person's totals.
create or replace function public.my_savings(p_user uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'saved', coalesce(sum(saved), 0), 'meals', count(*), 'verified', count(*) filter (where verified),
    'month', coalesce(sum(saved) filter (where cooked_on >= date_trunc('month', current_date)), 0)
  ) from public.cook_log where user_id = p_user;
$$;
revoke all on function public.my_savings(uuid) from public, anon, authenticated;

-- Savings milestone badges.
alter table public.user_badges drop constraint if exists user_badges_badge_check;
alter table public.user_badges add constraint user_badges_badge_check
  check (badge in ('first_copycat', 'top10', 'crowd_favorite', 'chef_pick', 'thriftiest', 'streak_4', 'brought_3',
                   'saved_100', 'saved_500', 'saved_1000', 'saved_5000', 'saved_10000'));

-- Comparable takeout prices for the sample Plateful originals.
update public.recipes set out_price = v.p from (values
  ('weeknight-eggs-on-avocado-toast-demo', 11.50), ('chef-style-shakshuka-demo', 14.00),
  ('grandma-style-cheesy-garlic-bread-demo', 6.50), ('weeknight-sheet-pan-sausage-and-peppers-demo', 15.00),
  ('chef-style-seared-salmon-demo', 24.00), ('grandma-style-apple-crisp-demo', 7.50),
  ('chef-style-mushroom-risotto-demo', 19.00), ('weeknight-chipotle-chicken-tacos-demo', 13.00)
) as v(slug, p) where recipes.slug = v.slug and recipes.out_price is null;

select (select count(*) from information_schema.tables where table_name = 'cook_log') as cook_log,
       (select count(*) from public.recipes where out_price is not null) as priced_originals;
