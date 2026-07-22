-- Persist Microsoft 365 connections per authenticated EMA user.
-- Tokens are encrypted by the application before they reach this table.

create table if not exists public.microsoft_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  encrypted_refresh_token text not null,
  microsoft_name text,
  microsoft_email text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_refreshed_at timestamptz
);

alter table public.microsoft_connections enable row level security;

-- Browser clients must never read or write Microsoft refresh tokens directly.
-- Server-side access is performed exclusively with the Supabase service role.
revoke all on table public.microsoft_connections from anon, authenticated;
grant all on table public.microsoft_connections to service_role;

comment on table public.microsoft_connections is
  'Encrypted Microsoft 365 refresh tokens, stored per EMA auth user and accessible only to server-side service-role code.';
comment on column public.microsoft_connections.encrypted_refresh_token is
  'AES-256-GCM encrypted Microsoft refresh token; never store plaintext tokens.';
