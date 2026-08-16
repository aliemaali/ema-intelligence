-- Schedule EMA's reminder dispatcher once per minute.
-- Secrets are read from Supabase Vault and are never stored in client code.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Before applying this migration, create Vault secrets named:
-- project_url = https://<project-ref>.supabase.co
-- ema_cron_secret = a high-entropy random secret
-- The Edge Function receives the same EMA_CRON_SECRET value.

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
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/ema-reminder-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-ema-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'ema_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
