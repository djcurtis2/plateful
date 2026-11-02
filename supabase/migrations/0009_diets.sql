-- Dietary preferences and "Make it my way" recipe versions.
-- Run after 0008_menu_serves.sql. Safe to re-run.

-- What a recipe contains (from Claude) and the diet tags worked out from it in app code.
alter table public.recipes add column if not exists contains text[] not null default '{}';
alter table public.recipes add column if not exists diet_tags text[] not null default '{}';
create index if not exists recipes_diet_tags_idx on public.recipes using gin (diet_tags);

-- A version of another recipe ("vegetarian", "air_fryer", ...). One shared version per kind per original.
alter table public.recipes add column if not exists variant_of uuid references public.recipes (id) on delete cascade;
alter table public.recipes add column if not exists variant_kind text check (variant_kind is null or variant_kind in
  ('vegetarian', 'vegan', 'gluten_free', 'dairy_free', 'lighter', 'high_protein', 'cheaper', 'kid_friendly', 'spicier', 'air_fryer'));
create unique index if not exists recipes_one_version_per_kind on public.recipes (variant_of, variant_kind) where variant_of is not null;

-- Each person's diets.
alter table public.profiles add column if not exists diets text[] not null default '{}';
alter table public.profiles drop constraint if exists profiles_diets_check;
alter table public.profiles add constraint profiles_diets_check
  check (diets <@ array['vegetarian', 'vegan', 'pescatarian', 'gluten_free', 'dairy_free', 'nut_free', 'low_carb']::text[]);

select count(*) filter (where column_name in ('contains', 'diet_tags', 'variant_of', 'variant_kind')) as recipe_cols
from information_schema.columns where table_schema = 'public' and table_name = 'recipes';
