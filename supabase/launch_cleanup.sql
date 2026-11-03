-- LAUNCH CLEANUP: removes the fake cooks and their points, keeps the sample recipes as house recipes.
-- Run once in the Supabase SQL editor before launch. Safe to re-run.
-- (demo_cleanup.sql removes the sample recipes too; don't use it after this.)

-- 1. Demo points, including the demo points on real accounts (an admin's 520 test points).
delete from public.points_events where ref like 'demo:%';

-- 2. The fake cooks (@demo.plateful.test). Cascades to their profiles, badges, gear and plays.
delete from auth.users where email like '%@demo.plateful.test';

-- 3. Sample recipes stay, as house recipes with no person attached: drop "-demo" from their web addresses
--    so links read /r/olive-garden-fettuccine-alfredo. Skipped for any name already taken.
update public.recipes r
set slug = regexp_replace(r.slug, '-demo$', '')
where r.slug like '%-demo'
  and not exists (select 1 from public.recipes x where x.slug = regexp_replace(r.slug, '-demo$', ''));

-- Check: all three should be 0.
select
  (select count(*) from auth.users where email like '%@demo.plateful.test') as fake_cooks_left,
  (select count(*) from public.points_events where ref like 'demo:%') as demo_points_left,
  (select count(*) from public.recipes where slug like '%-demo') as demo_slugs_left;
