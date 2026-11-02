-- Plateful originals: recipes Claude writes to use up leftovers (not restaurant copycats).
-- Run after 0004_meals.sql. Safe to re-run.
alter table public.recipes add column if not exists source text not null default 'snap';
alter table public.recipes drop constraint if exists recipes_source_check;
alter table public.recipes add constraint recipes_source_check check (source in ('snap', 'leftovers'));
-- e.g. "Grandma-style", "Weeknight", "Chef-style". Shown instead of "<restaurant> copycat".
alter table public.recipes add column if not exists style text check (style is null or char_length(style) <= 40);
-- The recipe whose leftovers this one uses up.
alter table public.recipes add column if not exists inspired_by uuid references public.recipes (id) on delete set null;

-- Leftover recipes are logged in scans (cost tracking + site cap) under their own marker, like receipts.
select count(*) filter (where column_name in ('source', 'style', 'inspired_by')) as new_cols
from information_schema.columns where table_schema = 'public' and table_name = 'recipes';
