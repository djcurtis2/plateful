-- Club pages: recipes a club's members cook and save most. Counts only, no names leave the database.
-- A recipe shows only once at least 3 different members made or saved it, so a small club never
-- reveals one person's history.
-- Run after 0010_avatars.sql. Safe to re-run. Called only by the server (service role).

create or replace function public.club_popular(club text, max_rows int) returns table (recipe_id uuid, members int)
language sql
security definer
set search_path = public
as $$
  with activity as (
    select c.user_id, c.recipe_id, c.created_at from public.cook_log c
    union all
    select s.user_id, s.recipe_id, coalesce(s.cooked_at, s.created_at) from public.saved_recipes s
  )
  select a.recipe_id, count(distinct a.user_id)::int as members
  from activity a
  join public.profiles p on p.id = a.user_id and club = any (p.clubs)
  join public.recipes r on r.id = a.recipe_id and r.is_public
  group by a.recipe_id
  having count(distinct a.user_id) >= 3
  order by members desc, max(a.created_at) desc
  limit greatest(coalesce(max_rows, 0), 0);
$$;

revoke execute on function public.club_popular(text, int) from public, anon, authenticated;
grant execute on function public.club_popular(text, int) to service_role;

select count(*) as club_popular_functions
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'club_popular';
