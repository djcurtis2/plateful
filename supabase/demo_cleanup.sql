-- Removes the demo leaderboard data from demo_leaderboard.sql.
delete from public.points_events where ref like 'demo:%';            -- includes the demo points on your own account
delete from auth.users where email like '%@demo.plateful.test';      -- cascades to their profiles
select count(*) as demo_users_left from auth.users where email like '%@demo.plateful.test';
