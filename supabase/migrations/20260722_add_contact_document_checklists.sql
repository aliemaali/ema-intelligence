create table if not exists public.contact_document_checklists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  entity_type text not null check (entity_type in ('partner', 'investor')),
  entity_id uuid not null,
  document_type text not null,
  status text not null default 'fehlt' check (status in ('vorhanden', 'fehlt', 'nicht_erforderlich')),
  updated_at timestamptz not null default now(),
  unique(user_id, entity_type, entity_id, document_type)
);

create index if not exists contact_document_checklists_owner_entity_idx
  on public.contact_document_checklists(user_id, entity_type, entity_id);

alter table public.contact_document_checklists enable row level security;

drop policy if exists contact_document_checklists_select_own on public.contact_document_checklists;
create policy contact_document_checklists_select_own on public.contact_document_checklists
for select to authenticated using (user_id = auth.uid());

drop policy if exists contact_document_checklists_insert_own on public.contact_document_checklists;
create policy contact_document_checklists_insert_own on public.contact_document_checklists
for insert to authenticated with check (user_id = auth.uid());

drop policy if exists contact_document_checklists_update_own on public.contact_document_checklists;
create policy contact_document_checklists_update_own on public.contact_document_checklists
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists contact_document_checklists_delete_own on public.contact_document_checklists;
create policy contact_document_checklists_delete_own on public.contact_document_checklists
for delete to authenticated using (user_id = auth.uid());
