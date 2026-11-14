-- Explicitly authorized production setup, 2026-11-14. Reuses existing Vault
-- credential and installed pg_cron/pg_net. Never embeds credentials in source.
-- Each visible email send still requires an immutable explicit user approval.
do $$
begin
 if not exists(select 1 from vault.secrets where name='ema_cron_secret') then
  raise exception 'Existing EMA cron credential missing';
 end if;
 if exists(select 1 from cron.job where jobname in ('ema-mail-worker-every-minute','ema-mail-approved-dispatch-every-minute')) then
  raise exception 'Mail schedule already exists; inspect it before changing';
 end if;
 perform cron.schedule('ema-mail-worker-every-minute','* * * * *', $job$
  select net.http_post(url:='https://app.ema-enterprise.de/api/cron/ema-mail',
    headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='ema_cron_secret')),
    body:='{}'::jsonb,timeout_milliseconds:=60000);
 $job$);
 perform cron.schedule('ema-mail-approved-dispatch-every-minute','* * * * *', $job$
  select net.http_post(url:='https://app.ema-enterprise.de/api/cron/ema-mail-dispatch',
    headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='ema_cron_secret')),
    body:='{}'::jsonb,timeout_milliseconds:=60000);
 $job$);
end $$;
