create table if not exists public.document_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique(user_id, name)
);

alter table public.document_folders enable row level security;

create policy "Users manage own document folders"
on public.document_folders
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

alter table public.template_documents
add column if not exists folder_id uuid references public.document_folders(id) on delete set null;

create index if not exists document_folders_user_id_idx on public.document_folders(user_id);
create index if not exists template_documents_folder_id_idx on public.template_documents(folder_id);
