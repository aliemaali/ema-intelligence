create table if not exists public.contact_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  entity_type text not null check (entity_type in ('partner', 'investor')),
  entity_id uuid not null,
  document_type text not null,
  file_name text not null,
  storage_path text not null unique,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

create index if not exists contact_documents_owner_entity_idx
  on public.contact_documents(user_id, entity_type, entity_id, created_at desc);

alter table public.contact_documents enable row level security;

drop policy if exists contact_documents_select_own on public.contact_documents;
create policy contact_documents_select_own on public.contact_documents
for select to authenticated using (user_id = auth.uid());

drop policy if exists contact_documents_insert_own on public.contact_documents;
create policy contact_documents_insert_own on public.contact_documents
for insert to authenticated with check (user_id = auth.uid());

drop policy if exists contact_documents_delete_own on public.contact_documents;
create policy contact_documents_delete_own on public.contact_documents
for delete to authenticated using (user_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'contact-documents',
  'contact-documents',
  false,
  20971520,
  array['application/pdf','image/jpeg','image/png','application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists contact_documents_storage_select on storage.objects;
create policy contact_documents_storage_select on storage.objects
for select to authenticated
using (bucket_id = 'contact-documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists contact_documents_storage_insert on storage.objects;
create policy contact_documents_storage_insert on storage.objects
for insert to authenticated
with check (bucket_id = 'contact-documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists contact_documents_storage_delete on storage.objects;
create policy contact_documents_storage_delete on storage.objects
for delete to authenticated
using (bucket_id = 'contact-documents' and (storage.foldername(name))[1] = auth.uid()::text);
