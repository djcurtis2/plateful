-- Removes the demo data from demo_leaderboard.sql and demo_recipes.sql.
delete from public.recipes where slug like '%-demo';
delete from storage.objects where bucket_id = 'dishes' and name like 'samples/%';  -- sample photos
delete from public.points_events where ref like 'demo:%';            -- includes the demo points on your own account
delete from auth.users where email like '%@demo.plateful.test';      -- cascades to their profiles
select count(*) as demo_users_left from auth.users where email like '%@demo.plateful.test';
