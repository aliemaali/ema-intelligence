alter table public.acquisition_leads
  add column if not exists deleted_at timestamptz;

create index if not exists acquisition_leads_user_deleted_idx
  on public.acquisition_leads (user_id, deleted_at);
