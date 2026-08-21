create table if not exists public.plaud_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  oauth_client_id text not null,
  encrypted_refresh_token text not null,
  encrypted_access_token text,
  access_token_expires_at timestamptz,
  connected_at timestamptz not null default now(),
  last_refreshed_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.plaud_connections enable row level security;
revoke all privileges on table public.plaud_connections from anon;
revoke all privileges on table public.plaud_connections from authenticated;
grant all privileges on table public.plaud_connections to service_role;

comment on table public.plaud_connections is
  'Encrypted PLAUD OAuth tokens per EMA user; accessible only to server-side service-role code.';
comment on column public.plaud_connections.encrypted_refresh_token is
  'AES-256-GCM encrypted PLAUD refresh token; never stores plaintext credentials.';

create table if not exists public.plaud_import_decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  external_id text not null,
  decision text not null check (decision in ('imported', 'rejected')),
  decided_at timestamptz not null default now(),
  unique (user_id, external_id)
);

alter table public.plaud_import_decisions enable row level security;

drop policy if exists plaud_import_decisions_owner on public.plaud_import_decisions;
create policy plaud_import_decisions_owner on public.plaud_import_decisions
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

revoke all privileges on table public.plaud_import_decisions from anon;
revoke all privileges on table public.plaud_import_decisions from authenticated;
grant select, insert, update, delete on table public.plaud_import_decisions to authenticated;

alter table public.plaud_notes add column if not exists duration_ms bigint;
alter table public.plaud_notes add column if not exists source_language text;
alter table public.plaud_notes add column if not exists summary_original text;
alter table public.plaud_notes add column if not exists summary_de text;
alter table public.plaud_notes add column if not exists transcript_original text;
alter table public.plaud_notes add column if not exists transcript_de text;
alter table public.plaud_notes add column if not exists imported_at timestamptz;

alter table public.plaud_items add column if not exists note_external_id text;

create index if not exists plaud_import_decisions_user_idx
  on public.plaud_import_decisions (user_id, decided_at desc);
create index if not exists plaud_items_note_external_idx
  on public.plaud_items (user_id, note_external_id, status);
