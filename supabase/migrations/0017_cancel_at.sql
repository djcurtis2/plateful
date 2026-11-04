-- When a cancelled Plus subscription stops, so Account can say "Ends" instead of "Renews".
-- Run after 0016_share_links.sql. Safe to re-run.
alter table public.profiles add column if not exists cancel_at timestamptz;

select count(*) as cancel_at_column from information_schema.columns
where table_schema = 'public' and table_name = 'profiles' and column_name = 'cancel_at';
