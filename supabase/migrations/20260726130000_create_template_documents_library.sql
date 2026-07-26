create table if not exists public.template_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  category text not null default 'sonstiges',
  file_name text not null,
  file_path text not null unique,
  file_size_bytes bigint,
  mime_type text,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.template_documents enable row level security;

create policy "Users can view own template documents"
on public.template_documents for select
using (auth.uid() = user_id);

create policy "Users can insert own template documents"
on public.template_documents for insert
with check (auth.uid() = user_id);

create policy "Users can update own template documents"
on public.template_documents for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own template documents"
on public.template_documents for delete
using (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'template-documents',
  'template-documents',
  false,
  52428800,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/plain',
    'application/zip'
  ]
)
on conflict (id) do nothing;

create policy "Users can upload own template files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'template-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can view own template files"
on storage.objects for select to authenticated
using (
  bucket_id = 'template-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can delete own template files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'template-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create or replace function public.set_template_documents_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists template_documents_updated_at on public.template_documents;
create trigger template_documents_updated_at
before update on public.template_documents
for each row execute function public.set_template_documents_updated_at();
