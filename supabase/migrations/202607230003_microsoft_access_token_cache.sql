-- Cache the short-lived Microsoft access token so parallel contacts/calendar
-- requests do not rotate the same refresh token at the same time.

alter table public.microsoft_connections
  add column if not exists encrypted_access_token text,
  add column if not exists access_token_expires_at timestamptz;

comment on column public.microsoft_connections.encrypted_access_token is
  'AES-256-GCM encrypted short-lived Microsoft access token.';
comment on column public.microsoft_connections.access_token_expires_at is
  'Expiry timestamp of the encrypted Microsoft access token.';
