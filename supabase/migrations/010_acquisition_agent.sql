-- EMA Acquisition Agent – Sprint 1
-- Fokus: Projektakquise und große Dachflächen

create table if not exists public.acquisition_leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  acquisition_type text not null check (acquisition_type in ('project', 'roof')),
  company_name text not null,
  contact_name text,
  contact_role text,
  email text,
  phone text,
  website text,
  street text,
  postal_code text,
  city text,
  state text,
  country text not null default 'Deutschland',
  source_name text,
  source_url text,
  source_checked_at timestamptz,
  project_type text check (project_type in ('pv_freiflaeche', 'pv_dach', 'bess', 'hybrid', 'other')),
  project_stage text,
  estimated_potential_kwp numeric,
  estimated_roof_area_sqm numeric,
  owner_status text check (owner_status in ('confirmed_owner', 'probable_owner', 'tenant', 'unknown')),
  existing_pv_status text check (existing_pv_status in ('none_visible', 'existing', 'unknown')),
  score integer not null default 0 check (score between 0 and 100),
  score_reason text,
  status text not null default 'new' check (
    status in (
      'new',
      'researching',
      'ready_for_approval',
      'approved',
      'contacted',
      'replied',
      'qualified',
      'rejected',
      'blocked'
    )
  ),
  notes text,
  next_action text,
  next_action_at timestamptz,
  blocked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.acquisition_emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid not null references public.acquisition_leads(id) on delete cascade,
  email_type text not null default 'initial' check (email_type in ('initial', 'follow_up_1', 'follow_up_2', 'reply')),
  recipient_email text not null,
  subject text not null,
  body text not null,
  status text not null default 'draft' check (
    status in ('draft', 'ready_for_approval', 'approved', 'sent', 'failed', 'cancelled')
  ),
  approval_note text,
  approved_at timestamptz,
  sent_at timestamptz,
  provider_message_id text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.acquisition_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid not null references public.acquisition_leads(id) on delete cascade,
  activity_type text not null check (
    activity_type in (
      'created',
      'researched',
      'scored',
      'email_created',
      'approved',
      'email_sent',
      'reply_received',
      'follow_up_scheduled',
      'status_changed',
      'note'
    )
  ),
  title text not null,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists acquisition_leads_user_id_idx on public.acquisition_leads(user_id);
create index if not exists acquisition_leads_type_status_idx on public.acquisition_leads(acquisition_type, status);
create index if not exists acquisition_leads_score_idx on public.acquisition_leads(score desc);
create index if not exists acquisition_emails_lead_id_idx on public.acquisition_emails(lead_id);
create index if not exists acquisition_emails_status_idx on public.acquisition_emails(status);
create index if not exists acquisition_activities_lead_id_idx on public.acquisition_activities(lead_id);

alter table public.acquisition_leads enable row level security;
alter table public.acquisition_emails enable row level security;
alter table public.acquisition_activities enable row level security;

create policy "Users manage own acquisition leads"
  on public.acquisition_leads
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own acquisition emails"
  on public.acquisition_emails
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own acquisition activities"
  on public.acquisition_activities
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.set_acquisition_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_acquisition_leads_updated_at on public.acquisition_leads;
create trigger set_acquisition_leads_updated_at
before update on public.acquisition_leads
for each row execute function public.set_acquisition_updated_at();

drop trigger if exists set_acquisition_emails_updated_at on public.acquisition_emails;
create trigger set_acquisition_emails_updated_at
before update on public.acquisition_emails
for each row execute function public.set_acquisition_updated_at();
