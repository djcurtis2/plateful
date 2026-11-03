-- 0012: profile names change only through the server; waitlist spam guard. Safe to re-run.

-- Profile names change only through setPublicName, which applies the name rules.
-- Signed-in browsers could previously update display_name / public_name directly with the anon key.
revoke update on public.profiles from authenticated;
revoke update (display_name, public_name) on public.profiles from authenticated;

-- Waitlist: remember a hashed network address so one source can't flood sign-ups.
alter table public.waitlist add column if not exists ip_hash text;
create index if not exists waitlist_ip_hash_idx on public.waitlist (ip_hash, created_at);

-- Check: expect profile_update_grants = 0 and waitlist_ip_hash = 1.
select
  (select count(*) from information_schema.column_privileges
    where table_schema = 'public' and table_name = 'profiles' and grantee = 'authenticated' and privilege_type = 'UPDATE') as profile_update_grants,
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'waitlist' and column_name = 'ip_hash') as waitlist_ip_hash;
