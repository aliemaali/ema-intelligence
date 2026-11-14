-- Prepared for isolated testing only. Never apply automatically to production.
begin;
alter table public.ema_mail_drafts drop constraint if exists ema_mail_drafts_status_check;
alter table public.ema_mail_drafts add constraint ema_mail_drafts_status_check check(status in ('draft','approved','scheduled','sending','submitted','uncertain'));
create table public.ema_mail_user_settings (
 user_id uuid not null references auth.users(id) on delete cascade, mailbox text not null,
 signature_text text not null default '' check(length(signature_text)<=4000), updated_at timestamptz not null default now(), primary key(user_id,mailbox)
);
create table public.ema_mail_templates (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 title text not null check(length(title) between 1 and 100), subject text not null check(length(subject)<=500), body text not null check(length(body)<=100000), body_html text, created_at timestamptz not null default now()
);
create table public.ema_mail_project_links (
 user_id uuid not null references auth.users(id) on delete cascade, mailbox text not null, message_id text not null,
 project_id uuid not null references public.projects(id) on delete cascade, subject text not null, sender text not null, created_at timestamptz not null default now(), primary key(user_id,mailbox,message_id,project_id)
);
create index ema_mail_project_links_project on public.ema_mail_project_links(user_id,project_id,created_at desc);
create table public.ema_mail_scheduled (
 id uuid primary key default gen_random_uuid(), draft_id uuid not null unique references public.ema_mail_drafts(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade, mailbox text not null, payload jsonb not null, content_hash text not null check(content_hash ~ '^[a-f0-9]{64}$'),
 run_at timestamptz not null, approved_at timestamptz not null default now(), claimed_at timestamptz,
 state text not null default 'pending' check(state in ('pending','sending','submitted','uncertain','cancelled','blocked')), last_error text,
 check(run_at>approved_at and run_at<=approved_at+interval '30 days')
);
create index ema_mail_scheduled_due on public.ema_mail_scheduled(run_at) where state='pending';
create table public.ema_mail_followups (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, mailbox text not null,
 message_id text not null, conversation_id text not null, reference_at timestamptz not null, expected_repliers jsonb not null, title text not null,
 run_at timestamptz not null, state text not null default 'pending' check(state in ('pending','checking','answered','reminded','cancelled','blocked')), claimed_at timestamptz, reminder_id uuid, last_error text,
 unique(user_id,mailbox,message_id,run_at)
);
create index ema_mail_followups_due on public.ema_mail_followups(run_at) where state='pending';
create function public.ema_mail_schedule_draft(p_user_id uuid,p_draft_id uuid,p_hash text) returns uuid language plpgsql security invoker set search_path=pg_catalog,public as $$
declare d public.ema_mail_drafts; job_id uuid; run_time timestamptz;
begin
 select * into d from public.ema_mail_drafts where id=p_draft_id and user_id=p_user_id and content_hash=p_hash and status in ('draft','approved') for update;
 if not found then raise exception 'Draft unavailable'; end if;
 run_time=(d.payload->>'scheduledAt')::timestamptz;
 if run_time is null or run_time<now()+interval '1 minute' or run_time>now()+interval '30 days' then raise exception 'Invalid schedule'; end if;
 insert into public.ema_mail_scheduled(draft_id,user_id,mailbox,payload,content_hash,run_at) values(d.id,d.user_id,d.payload->>'mailbox',d.payload,d.content_hash,run_time) on conflict(draft_id) do update set payload=excluded.payload,content_hash=excluded.content_hash,run_at=excluded.run_at,approved_at=now(),state='pending',claimed_at=null,last_error=null where ema_mail_scheduled.state in ('cancelled','blocked') returning id into job_id;
 if job_id is null then raise exception 'Schedule unavailable'; end if;
 update public.ema_mail_drafts set status='scheduled',approval_hash=null,approval_expires_at=null,updated_at=now() where id=d.id;
 return job_id;
end $$;
create function public.ema_mail_cancel_schedule(p_user_id uuid,p_id uuid) returns boolean language plpgsql security invoker set search_path=pg_catalog,public as $$
declare draft uuid;
begin
 update public.ema_mail_scheduled set state='cancelled' where id=p_id and user_id=p_user_id and state in ('pending','blocked') returning draft_id into draft;
 if not found then return false; end if;
 update public.ema_mail_drafts set status='draft',approval_hash=null,approval_expires_at=null,updated_at=now() where id=draft and user_id=p_user_id and status='scheduled';
 return true;
end $$;
create function public.ema_mail_claim_scheduled() returns setof public.ema_mail_scheduled language sql security invoker set search_path=pg_catalog,public as $$
 update public.ema_mail_scheduled set state='sending',claimed_at=now() where id in (select id from public.ema_mail_scheduled where state='pending' and run_at<=now() order by run_at for update skip locked limit 1) returning *;
$$;
create function public.ema_mail_claim_followup() returns setof public.ema_mail_followups language sql security invoker set search_path=pg_catalog,public as $$
 update public.ema_mail_followups set state='checking',claimed_at=now() where id in (select id from public.ema_mail_followups where state='pending' and run_at<=now() order by run_at for update skip locked limit 1) returning *;
$$;
do $$ declare t text; begin
 foreach t in array array['ema_mail_user_settings','ema_mail_templates','ema_mail_project_links','ema_mail_scheduled','ema_mail_followups'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
revoke all on function public.ema_mail_schedule_draft(uuid,uuid,text),public.ema_mail_cancel_schedule(uuid,uuid),public.ema_mail_claim_scheduled(),public.ema_mail_claim_followup() from public,anon,authenticated;
grant execute on function public.ema_mail_schedule_draft(uuid,uuid,text),public.ema_mail_cancel_schedule(uuid,uuid),public.ema_mail_claim_scheduled(),public.ema_mail_claim_followup() to service_role;
commit;
