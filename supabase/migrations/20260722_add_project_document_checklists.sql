create table if not exists public.project_document_checklists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  document_type text not null,
  status text not null check (status in ('vorhanden', 'fehlt', 'nicht_erforderlich')),
  updated_at timestamptz not null default now(),
  unique (project_id, document_type)
);

create index if not exists project_document_checklists_owner_project_idx
  on public.project_document_checklists(user_id, project_id);

alter table public.project_document_checklists enable row level security;

drop policy if exists project_document_checklists_select_own on public.project_document_checklists;
create policy project_document_checklists_select_own on public.project_document_checklists
for select to authenticated using (user_id = auth.uid());

drop policy if exists project_document_checklists_insert_own on public.project_document_checklists;
create policy project_document_checklists_insert_own on public.project_document_checklists
for insert to authenticated with check (user_id = auth.uid());

drop policy if exists project_document_checklists_update_own on public.project_document_checklists;
create policy project_document_checklists_update_own on public.project_document_checklists
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists project_document_checklists_delete_own on public.project_document_checklists;
create policy project_document_checklists_delete_own on public.project_document_checklists
for delete to authenticated using (user_id = auth.uid());
