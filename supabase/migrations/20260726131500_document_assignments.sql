create table if not exists public.document_assignments (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.template_documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null check (entity_type in ('partner', 'investor', 'project')),
  entity_id uuid not null,
  created_at timestamptz not null default now(),
  unique(document_id, entity_type, entity_id)
);

create index if not exists document_assignments_user_idx on public.document_assignments(user_id);
create index if not exists document_assignments_document_idx on public.document_assignments(document_id);
create index if not exists template_documents_user_idx on public.template_documents(user_id);

alter table public.document_assignments enable row level security;

create policy "Users manage own document assignments"
on public.document_assignments
for all to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.template_documents d
    where d.id = document_id
      and d.user_id = (select auth.uid())
  )
);
