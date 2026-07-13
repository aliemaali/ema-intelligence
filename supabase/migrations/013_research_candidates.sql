create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.acquisition_research_candidates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  acquisition_type text not null check (acquisition_type in ('project', 'roof')),
  company_name text not null,
  website text,
  email text,
  contact_name text,
  contact_role text,
  city text,
  state text,
  source_name text not null default 'EMA Scout Web-Recherche',
  source_url text,
  source_snippet text,
  project_type text,
  project_stage text,
  estimated_potential_kwp numeric,
  estimated_roof_area_sqm numeric,
  score integer not null default 0 check (score between 0 and 100),
  status text not null default 'new' check (status in ('new', 'approved', 'rejected', 'duplicate')),
  duplicate_reason text,
  reviewed_at timestamptz,
  imported_lead_id uuid references public.acquisition_leads(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists acquisition_research_candidates_user_status_idx
  on public.acquisition_research_candidates(user_id, status, created_at desc);

create unique index if not exists acquisition_research_candidates_user_source_url_idx
  on public.acquisition_research_candidates(user_id, source_url)
  where source_url is not null;

alter table public.acquisition_research_candidates enable row level security;

drop policy if exists "Users manage own research candidates" on public.acquisition_research_candidates;
create policy "Users manage own research candidates"
  on public.acquisition_research_candidates
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists set_acquisition_research_candidates_updated_at on public.acquisition_research_candidates;
create trigger set_acquisition_research_candidates_updated_at
before update on public.acquisition_research_candidates
for each row execute function public.set_updated_at();
