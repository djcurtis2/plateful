-- Plan my week: every meal (breakfast, lunch, dinner, snacks), picked by Dupe Kitchen or by hand,
-- and cooks' own private recipes. Run after 0014_games.sql. Safe to re-run.

-- One entry per spot in the week: { day 0-6, meal, id (recipe or null = open), leftover?, made? }.
-- Older plans have no slots; their recipe_ids are read as one dinner a day.
alter table public.meal_plans add column if not exists slots jsonb;

-- "own" = a recipe a cook typed in themselves. Saved with is_public = false, so only they can read it
-- (the existing "recipes: public read" policy already allows is_public or the owner).
alter table public.recipes drop constraint if exists recipes_source_check;
alter table public.recipes add constraint recipes_source_check check (source in ('snap', 'leftovers', 'own'));

select
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'meal_plans' and column_name = 'slots') as slots_column,
  (select pg_get_constraintdef(oid) from pg_constraint where conname = 'recipes_source_check') as source_check;
