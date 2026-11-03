-- Share your own recipes by private link: /r/<slug>?k=<share_token>. Anyone with the link can read it
-- (served by the server after checking the token); it's never listed or searchable. Clearing the token
-- turns the link off. Copies people save point back with inspired_by.
-- Run after 0015_week_plans.sql. Safe to re-run.
alter table public.recipes add column if not exists share_token uuid;
create unique index if not exists recipes_share_token_idx on public.recipes (share_token) where share_token is not null;

select count(*) as share_token_column from information_schema.columns
where table_schema = 'public' and table_name = 'recipes' and column_name = 'share_token';
