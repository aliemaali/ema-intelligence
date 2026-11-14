-- Operator example for an explicitly isolated test database only. NOT a migration.
-- Required Vault secrets in the isolated test DB:
-- ema_environment = mail-test
-- ema_mail_dispatch_url = https://YOUR-ISOLATED-TEST-HOST/api/cron/ema-mail-dispatch
-- ema_cron_secret = the test deployment's CRON_SECRET
-- Also configure the test deployment's EMA_MAIL_ENABLED and
-- EMA_MAIL_SCHEDULED_SEND_ENABLED. Vercel previews intentionally refuse real sends.
do $$
declare environment text; target text;
begin
 select decrypted_secret into environment from vault.decrypted_secrets where name='ema_environment';
 select decrypted_secret into target from vault.decrypted_secrets where name='ema_mail_dispatch_url';
 if environment is distinct from 'mail-test' then raise exception 'Isolated mail-test environment required'; end if;
 if target is null or target !~ '^https://[^/]+/api/cron/ema-mail-dispatch$'
   or target like '%app.ema-enterprise.de%' or target like '%office.ema-enterprise.de%' or target like '%ema-intelligence.vercel.app%'
 then raise exception 'Explicit isolated test target required'; end if;
 if exists(select 1 from cron.job where jobname='ema-mail-approved-dispatch-test') then raise exception 'Test job already exists'; end if;
 perform cron.schedule('ema-mail-approved-dispatch-test','* * * * *',$job$
 select net.http_post(
  url := (select decrypted_secret from vault.decrypted_secrets where name='ema_mail_dispatch_url'),
  headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='ema_cron_secret')),
  body := '{}'::jsonb,
  timeout_milliseconds := 60000
 );
 $job$);
end $$;
