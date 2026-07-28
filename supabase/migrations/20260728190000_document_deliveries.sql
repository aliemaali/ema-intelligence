create table if not exists public.document_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  document_type text not null default 'investment_memorandum',
  recipient_id uuid null,
  recipient_name text not null,
  recipient_email text null,
  recipient_type text not null check (recipient_type in ('investor', 'partner', 'manual')),
  channel text not null check (channel in ('email', 'whatsapp')),
  status text not null check (status in ('sent', 'shared', 'failed')),
  sent_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists document_deliveries_user_sent_idx
  on public.document_deliveries (user_id, sent_at desc);

create index if not exists document_deliveries_project_sent_idx
  on public.document_deliveries (project_id, sent_at desc);

alter table public.document_deliveries enable row level security;

drop policy if exists "Users can view own document deliveries" on public.document_deliveries;
create policy "Users can view own document deliveries"
  on public.document_deliveries for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create own document deliveries" on public.document_deliveries;
create policy "Users can create own document deliveries"
  on public.document_deliveries for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own document deliveries" on public.document_deliveries;
create policy "Users can update own document deliveries"
  on public.document_deliveries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.document_deliveries is
  'Nachvollziehbare Versandhistorie für Investment Memoranden und weitere Projektdokumente.';
