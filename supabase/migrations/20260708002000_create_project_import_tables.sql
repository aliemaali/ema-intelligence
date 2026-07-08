-- EMA Intelligence – Project Import tables
-- Stores upload jobs and later KI/OCR extraction results.

create table if not exists public.project_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  partner_id uuid null,
  project_id uuid null,
  import_status text not null default 'uploaded' check (import_status in ('uploaded', 'analyzing', 'ready', 'created', 'failed')),
  source_type text not null default 'upload' check (source_type in ('upload', 'photo', 'screenshot', 'email', 'zip')),
  file_count integer not null default 0,
  storage_bucket text not null default 'project-imports',
  storage_paths text[] not null default '{}',
  original_file_names text[] not null default '{}',
  error_message text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_import_results (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.project_imports(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,

  partner_project_number text null,
  detected_partner_name text null,
  project_name text null,
  project_type text null,

  location_address text null,
  location_postal_code text null,
  location_city text null,
  location_state text null,
  location_country text not null default 'Deutschland',
  location_lat numeric null,
  location_lng numeric null,

  pv_kwp numeric null,
  bess_mw numeric null,
  bess_mwh numeric null,
  feed_in_type text null,
  purchase_price numeric null,

  confidence_score numeric null,
  missing_fields text[] not null default '{}',
  raw_extracted_text text null,
  raw_result jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_project_imports_user_id on public.project_imports(user_id);
create index if not exists idx_project_imports_status on public.project_imports(import_status);
create index if not exists idx_project_import_results_import_id on public.project_import_results(import_id);
create index if not exists idx_project_import_results_user_id on public.project_import_results(user_id);

alter table public.project_imports enable row level security;
alter table public.project_import_results enable row level security;

drop policy if exists project_imports_select_own on public.project_imports;
drop policy if exists project_imports_insert_own on public.project_imports;
drop policy if exists project_imports_update_own on public.project_imports;
drop policy if exists project_imports_delete_own on public.project_imports;

create policy project_imports_select_own
  on public.project_imports
  for select
  to authenticated
  using (user_id = auth.uid());

create policy project_imports_insert_own
  on public.project_imports
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy project_imports_update_own
  on public.project_imports
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy project_imports_delete_own
  on public.project_imports
  for delete
  to authenticated
  using (user_id = auth.uid());

drop policy if exists project_import_results_select_own on public.project_import_results;
drop policy if exists project_import_results_insert_own on public.project_import_results;
drop policy if exists project_import_results_update_own on public.project_import_results;
drop policy if exists project_import_results_delete_own on public.project_import_results;

create policy project_import_results_select_own
  on public.project_import_results
  for select
  to authenticated
  using (user_id = auth.uid());

create policy project_import_results_insert_own
  on public.project_import_results
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy project_import_results_update_own
  on public.project_import_results
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy project_import_results_delete_own
  on public.project_import_results
  for delete
  to authenticated
  using (user_id = auth.uid());
