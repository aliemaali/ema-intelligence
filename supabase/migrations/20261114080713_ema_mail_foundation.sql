-- Additive only. Apply to an isolated test database first. No production execution.
begin;
create table public.ema_mail_memberships (
  user_id uuid not null references auth.users(id) on delete cascade,
  mailbox text not null check (mailbox = lower(mailbox) and length(mailbox) <= 254 and mailbox ~ '^[^/@[:space:]]+@[^/@[:space:]]+\.[^/@[:space:]]+$'),
  can_read boolean not null default true,
  can_write boolean not null default false,
  can_send boolean not null default false,
  primary key(user_id,mailbox),
  check (can_read or (not can_write and not can_send))
);
create table public.ema_mail_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null,
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'draft' check(status in ('draft','approved','sending','submitted','uncertain')),
  approval_hash text,
  approval_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status='approved' and approval_hash is not null and approval_expires_at is not null) or (status<>'approved' and approval_hash is null and approval_expires_at is null))
);
create index ema_mail_drafts_owner_idx on public.ema_mail_drafts(user_id,updated_at desc);
create table public.ema_mail_audit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  resource_id text,
  created_at timestamptz not null default now()
);
create index ema_mail_audit_user_time_idx on public.ema_mail_audit(user_id,created_at desc);
create table public.ema_mail_analysis (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_hash text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  unique(user_id,source_hash)
);
-- New tables are server-only. Even an authenticated user cannot forge an approval,
-- insert shared-mailbox rights, edit audit records or read cached mail via REST.
-- The API checks user/MFA/profile before every service-role access and scopes every
-- query by user_id. No automatic grants based on editable JWT user_metadata.
alter table public.ema_mail_memberships enable row level security;
alter table public.ema_mail_drafts enable row level security;
alter table public.ema_mail_audit enable row level security;
alter table public.ema_mail_analysis enable row level security;
revoke all on public.ema_mail_memberships,public.ema_mail_drafts,public.ema_mail_audit,public.ema_mail_analysis from public,anon,authenticated;
grant all on public.ema_mail_memberships,public.ema_mail_drafts,public.ema_mail_audit,public.ema_mail_analysis to service_role;
commit;
