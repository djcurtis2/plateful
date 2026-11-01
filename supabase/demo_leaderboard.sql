-- DEMO DATA: fake cooks with points so you can see the leaderboard filled in.
-- Run in the Supabase SQL editor. Remove everything with demo_cleanup.sql.
-- Demo accounts use @demo.plateful.test emails and have no password, so nobody can sign in as them.
do $$
declare
  ch uuid := (select id from public.challenges where starts_at <= now() order by starts_at desc limit 1);
  names text[] := array['Maya R.','Big Al Cooks','Priya Eats','Jordan T','Copycat Carla','Sam the Sous','Lena Bakes','Marcus G','Tiny Kitchen Tom','Rosa M','Dev Makes Dinner','Hannah P'];
  wk int[]    := array[ 245, 210, 182, 160, 131, 117,  96,  80,  62,  45,  28,  12];  -- this cook-off
  past int[]  := array[ 980, 640, 1610, 320, 455, 210, 130, 760,  90,  60, 300,  40];  -- earlier weeks
  uid uuid;
  i int;
begin
  for i in 1 .. array_length(names, 1) loop
    uid := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
            'demo' || i || '@demo.plateful.test', '{}', '{}', now(), now());
    -- the signup trigger creates the profile; give it a public name
    update public.profiles set public_name = names[i] where id = uid;
    if ch is not null then
      insert into public.points_events (user_id, kind, points, ref, challenge_id)
      values (uid, 'post', wk[i], 'demo:week', ch);
    end if;
    insert into public.points_events (user_id, kind, points, ref, challenge_id, created_at)
    values (uid, 'post', past[i], 'demo:past', null, now() - interval '20 days');
  end loop;

  -- Put you (the admin account) in the middle of the pack so you can see your row highlighted.
  for uid in select id from public.profiles where is_admin loop
    if ch is not null then
      insert into public.points_events (user_id, kind, points, ref, challenge_id) values (uid, 'post', 140, 'demo:week', ch)
      on conflict do nothing;
    end if;
    insert into public.points_events (user_id, kind, points, ref, challenge_id) values (uid, 'post', 380, 'demo:past', null)
    on conflict do nothing;
  end loop;
end $$;

select p.public_name, sum(e.points) as points
from public.points_events e join public.profiles p on p.id = e.user_id
group by p.public_name order by points desc;

-- Demo badges (demo accounts only; removed with them by demo_cleanup.sql).
insert into public.user_badges (user_id, badge)
select p.id, b.badge
from public.profiles p
join auth.users u on u.id = p.id and u.email like '%@demo.plateful.test'
join (values
  ('Maya R.', 'first_copycat'), ('Maya R.', 'top10'), ('Maya R.', 'crowd_favorite'), ('Maya R.', 'streak_4'),
  ('Big Al Cooks', 'first_copycat'), ('Big Al Cooks', 'top10'), ('Big Al Cooks', 'brought_3'),
  ('Priya Eats', 'first_copycat'), ('Priya Eats', 'top10'), ('Priya Eats', 'chef_pick'), ('Priya Eats', 'thriftiest'), ('Priya Eats', 'streak_4'),
  ('Jordan T', 'first_copycat'), ('Jordan T', 'thriftiest'),
  ('Copycat Carla', 'first_copycat'), ('Copycat Carla', 'top10'),
  ('Sam the Sous', 'first_copycat'),
  ('Marcus G', 'first_copycat'), ('Marcus G', 'chef_pick'), ('Marcus G', 'streak_4'),
  ('Lena Bakes', 'first_copycat'), ('Rosa M', 'first_copycat'), ('Dev Makes Dinner', 'first_copycat'), ('Dev Makes Dinner', 'top10')
) as b(name, badge) on b.name = p.public_name
on conflict do nothing;
select count(*) as demo_badges from public.user_badges ub join auth.users u on u.id = ub.user_id where u.email like '%@demo.plateful.test';
