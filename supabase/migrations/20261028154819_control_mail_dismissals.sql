create table public.control_mail_dismissals (
  user_id uuid not null references auth.users(id) on delete cascade,
  mailbox text not null check (mailbox in ('info@ema-enterprise.de','unluer@ema-enterprise.de')),
  message_key text not null check (message_key ~ '^[0-9a-f]{64}$'),
  dismissed_at timestamptz not null default now(),
  primary key (user_id,mailbox,message_key)
);
alter table public.control_mail_dismissals enable row level security;
revoke all on public.control_mail_dismissals from anon, authenticated;
grant select, insert, delete on public.control_mail_dismissals to authenticated;
create policy "Users read own hidden mail" on public.control_mail_dismissals for select to authenticated using ((select auth.uid())=user_id);
create policy "Users hide own mail" on public.control_mail_dismissals for insert to authenticated with check ((select auth.uid())=user_id);
create policy "Users restore own mail" on public.control_mail_dismissals for delete to authenticated using ((select auth.uid())=user_id);
comment on table public.control_mail_dismissals is 'Per-user EMA overview visibility only; does not modify or delete Microsoft mail. Message identities are SHA-256 fingerprints.';

