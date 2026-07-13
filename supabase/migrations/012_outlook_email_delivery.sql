-- EMA Scout – Sprint 5
-- Sichere Outlook-Zustellung mit atomarem Versandstatus

alter table public.acquisition_emails
  drop constraint if exists acquisition_emails_status_check;

alter table public.acquisition_emails
  add constraint acquisition_emails_status_check
  check (status in ('draft', 'ready_for_approval', 'approved', 'sending', 'sent', 'failed', 'cancelled'));

create index if not exists acquisition_emails_user_status_idx
  on public.acquisition_emails(user_id, status);
