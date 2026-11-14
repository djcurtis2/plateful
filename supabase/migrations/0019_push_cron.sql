-- 0019: hourly push-notification tick (Supabase pg_cron + pg_net).
-- The job calls the site's /api/push/tick every hour at minute 0; the site works out who is due on their own local clock.
--
-- BEFORE running this file, create the two Vault secrets once, in the SQL editor (put your real values in; never save them in a file):
--   select vault.create_secret('https://yumjack.app/api/push/tick', 'push_tick_url');
--   select vault.create_secret('<the same value as PUSH_CRON_SECRET in Vercel>', 'push_cron_secret');
-- This file is safe to run again: it replaces the job instead of adding a second one.

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'yumjack-push-tick') then
    perform cron.unschedule('yumjack-push-tick');
  end if;
end $$;

select cron.schedule(
  'yumjack-push-tick',
  '0 * * * *',
  $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'push_tick_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $job$
);
