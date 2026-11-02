-- "Plan my week" (Plateful Plus). A plan stores its settings and the chosen recipes in order;
-- costs, the grocery list and leftovers are worked out fresh each time it's shown.
-- Run after 0005_originals.sql. Safe to re-run.
create table if not exists public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  settings jsonb not null,
  recipe_ids uuid[] not null default '{}',
  -- Recipes swapped out of this plan, so Swap doesn't offer them again.
  swapped uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists meal_plans_user_idx on public.meal_plans (user_id, created_at desc);
alter table public.meal_plans enable row level security;
drop policy if exists "meal plans: read own" on public.meal_plans;
create policy "meal plans: read own" on public.meal_plans for select using (auth.uid() = user_id);

select count(*) as meal_plans_table from information_schema.tables where table_schema = 'public' and table_name = 'meal_plans';
