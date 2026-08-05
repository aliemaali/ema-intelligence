create table if not exists public.country_project_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  country text not null,
  country_code text,
  display_name text not null,
  file_name text not null,
  file_path text not null unique,
  file_size_bytes bigint not null default 0,
  mime_type text not null default 'application/pdf',
  plant_type text,
  project_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.country_project_lists enable row level security;

create policy "country_project_lists_select_own"
  on public.country_project_lists for select
  using (auth.uid() = user_id);

create policy "country_project_lists_insert_own"
  on public.country_project_lists for insert
  with check (auth.uid() = user_id);

create policy "country_project_lists_update_own"
  on public.country_project_lists for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "country_project_lists_delete_own"
  on public.country_project_lists for delete
  using (auth.uid() = user_id);

create index if not exists country_project_lists_user_country_idx
  on public.country_project_lists(user_id, country, created_at desc);
