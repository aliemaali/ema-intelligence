-- OPERATOR EXAMPLE ONLY. Not an automatic migration. Do not run on production.
-- Requires pg_cron/pg_net and test-only Vault entries configured by the operator:
-- ema_environment='mail-test', ema_mail_cron_url=<isolated HTTPS /api/cron/ema-mail>,
-- ema_cron_secret=<the isolated test instance's CRON_SECRET>. No values in git.
do $$
declare target_url text;
begin
 if (select decrypted_secret from vault.decrypted_secrets where name='ema_environment') is distinct from 'mail-test' then
  raise exception 'Only an explicitly marked isolated mail-test environment is allowed.';
 end if;
 select decrypted_secret into target_url from vault.decrypted_secrets where name='ema_mail_cron_url';
 if target_url is null or target_url !~ '^https://[^/]+/api/cron/ema-mail$' or target_url ~ 'app\.ema-enterprise\.de|office\.ema-enterprise\.de' then
  raise exception 'A separate HTTPS test endpoint is required.';
 end if;
 if exists(select 1 from cron.job where jobname='ema-mail-test-every-minute') then
  raise exception 'Test schedule already exists; inspect it instead of duplicating.';
 end if;
 perform cron.schedule('ema-mail-test-every-minute','* * * * *', $job$
   select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='ema_mail_cron_url'),
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='ema_cron_secret')),
    body := '{}'::jsonb
   );
 $job$);
end $$;
