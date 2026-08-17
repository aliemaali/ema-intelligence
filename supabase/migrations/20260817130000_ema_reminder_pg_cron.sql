-- Per-minute reminder dispatch via pg_cron + pg_net, calling the Next.js
-- cron route directly (no Supabase Edge Function involved).
--
-- The Vercel account this project deploys to is on the Hobby plan, which
-- only allows daily Vercel Cron invocations - nowhere near enough for
-- "remind me at 21:10". pg_cron has no such limit, so it is the primary,
-- minute-resolution scheduler; Vercel Cron (see vercel.json) is kept as a
-- once-daily backup that works within the Hobby plan's limits.
--
-- This migration does NOT contain any secret values. The URL and shared
-- secret it references are stored in Supabase Vault under the names
-- 'ema_app_cron_url' and 'ema_cron_secret' (created out-of-band, not via a
-- migration, so they never end up in git history).

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'ema-reminder-push-every-minute') then
    perform cron.unschedule('ema-reminder-push-every-minute');
  end if;
end $$;

select cron.schedule(
  'ema-reminder-push-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'ema_app_cron_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'ema_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
