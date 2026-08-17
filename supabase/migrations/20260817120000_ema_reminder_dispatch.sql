-- EMA reminder push dispatch: atomic claim function + scheduler heartbeat.
--
-- Replaces the earlier pg_cron-based design (20260816191000_ema_push_cron.sql),
-- which depended on manually created Supabase Vault secrets and was never
-- actually applied, and on the Supabase Edge Function in
-- supabase/functions/ema-reminder-push, which was never deployed. Neither ever
-- ran in production, so reminders were saved but nothing ever sent them.
--
-- The dispatcher now lives in the Next.js app itself
-- (src/app/api/cron/ema-reminders/route.ts), triggered by Vercel Cron. This
-- function gives it a single atomic "claim" step so two overlapping
-- invocations can never send the same reminder twice.

create or replace function public.claim_due_reminders(p_limit integer default 100)
returns table (id uuid, user_id uuid, title text, due_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.ema_reminders r
  set push_sent_at = now()
  from (
    select rr.id
    from public.ema_reminders rr
    where rr.completed_at is null
      and rr.push_sent_at is null
      and rr.due_at <= now()
      and exists (
        select 1 from public.ema_push_subscriptions ps where ps.user_id = rr.user_id
      )
    order by rr.due_at asc
    limit greatest(p_limit, 0)
    for update of rr skip locked
  ) as due
  where r.id = due.id
  returning r.id, r.user_id, r.title, r.due_at;
end;
$$;

revoke all on function public.claim_due_reminders(integer) from public;
revoke all on function public.claim_due_reminders(integer) from anon, authenticated;
grant execute on function public.claim_due_reminders(integer) to service_role;

-- Single-row heartbeat the cron route updates on every run, so the client-side
-- diagnostics panel can show whether the scheduler is actually alive without
-- ever exposing secrets.
create table if not exists public.ema_cron_heartbeat (
  id boolean primary key default true,
  last_run_at timestamptz not null default now(),
  last_checked_count integer not null default 0,
  last_sent_count integer not null default 0,
  constraint ema_cron_heartbeat_singleton check (id)
);

insert into public.ema_cron_heartbeat (id, last_run_at)
values (true, '1970-01-01T00:00:00Z')
on conflict (id) do nothing;

alter table public.ema_cron_heartbeat enable row level security;

drop policy if exists "ema_cron_heartbeat_read" on public.ema_cron_heartbeat;
create policy "ema_cron_heartbeat_read" on public.ema_cron_heartbeat for select to authenticated using (true);

grant select on public.ema_cron_heartbeat to authenticated;
grant select, update on public.ema_cron_heartbeat to service_role;
