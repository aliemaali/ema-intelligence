-- Prepared only: do not apply to production without explicit release approval.
begin;
alter table public.ema_mail_drafts add column source_key text, add column provider_draft_id text;
create unique index ema_mail_draft_source_idx on public.ema_mail_drafts(user_id,source_key) where source_key is not null;
create table public.ema_mail_sync (
 user_id uuid not null references auth.users(id) on delete cascade,
 mailbox text not null,
 enabled boolean not null default false,
 "analyze" boolean not null default false,
 push boolean not null default false,
 enabled_since timestamptz not null default now(),
 cursor text,
 folder_id text,
 last_success_at timestamptz,
 last_error text,
 next_run_at timestamptz not null default now(),
 lease_id uuid,
 leased_until timestamptz,
 primary key(user_id,mailbox),
 check(mailbox='me' or (mailbox=lower(mailbox) and mailbox ~ '^[^/@[:space:]]+@[^/@[:space:]]+\.[^/@[:space:]]+$'))
);
create index ema_mail_sync_due_idx on public.ema_mail_sync(next_run_at) where enabled;
create table public.ema_mail_jobs (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null,
 mailbox text not null,
 message_id text not null,
 state text not null default 'pending' check(state in ('pending','processing','done','failed','cancelled')),
 attempts integer not null default 0,
 available_at timestamptz not null default now(),
 lease_id uuid,
 leased_until timestamptz,
 analysis_done boolean not null default false,
 push_state text not null default 'pending' check(push_state in ('pending','claimed','sent','uncertain','skipped','no_devices')),
 last_error text,
 created_at timestamptz not null default now(),
 unique(user_id,mailbox,message_id),
 foreign key(user_id,mailbox) references public.ema_mail_sync(user_id,mailbox) on delete cascade
);
create index ema_mail_jobs_due_idx on public.ema_mail_jobs(available_at) where state in ('pending','processing');
alter table public.ema_mail_sync enable row level security;
alter table public.ema_mail_jobs enable row level security;
revoke all on public.ema_mail_sync,public.ema_mail_jobs from public,anon,authenticated;
grant all on public.ema_mail_sync,public.ema_mail_jobs to service_role;
create function public.ema_mail_claim_sync()
returns setof public.ema_mail_sync language sql security invoker set search_path=pg_catalog,public as $$
 update public.ema_mail_sync set lease_id=gen_random_uuid(),leased_until=now()+interval '2 minutes',next_run_at=now()+interval '5 minutes'
 where (user_id,mailbox) in (select user_id,mailbox from public.ema_mail_sync where enabled and next_run_at<=now() and (leased_until is null or leased_until<now()) order by next_run_at for update skip locked limit 1)
 returning *;
$$;
create function public.ema_mail_claim_job()
returns setof public.ema_mail_jobs language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
 update public.ema_mail_jobs set state='failed',lease_id=null,leased_until=null,last_error='Maximale Versuche nach abgebrochenem Lauf erreicht.' where state='processing' and attempts>=6 and leased_until<now();
 return query update public.ema_mail_jobs set state='processing',attempts=attempts+1,lease_id=gen_random_uuid(),leased_until=now()+interval '2 minutes'
 where id in (select id from public.ema_mail_jobs where state in ('pending','processing') and attempts<6 and available_at<=now() and (leased_until is null or leased_until<now()) order by available_at for update skip locked limit 1)
 returning *;
end;
$$;
revoke all on function public.ema_mail_claim_sync(),public.ema_mail_claim_job() from public,anon,authenticated;
grant execute on function public.ema_mail_claim_sync(),public.ema_mail_claim_job() to service_role;
create table public.ema_mail_insights (
 user_id uuid not null references auth.users(id) on delete cascade,
 mailbox text not null,
 message_id text not null,
 result jsonb not null,
 updated_at timestamptz not null default now(),
 primary key(user_id,mailbox,message_id)
);
alter table public.ema_mail_insights enable row level security;
revoke all on public.ema_mail_insights from public,anon,authenticated;
grant all on public.ema_mail_insights to service_role;
-- Crash on the last attempt remains observable; no automatic mail sending exists.
commit;
