-- EMA DMS is the canonical document catalogue for EMA Intelligence and EMA Office.
-- Existing file objects are not copied. Their original bucket/path is referenced so
-- every binary continues to exist exactly once while all apps use one catalogue.

alter table public.documents
  alter column project_id drop not null;

alter table public.document_folders
  add column if not exists parent_id uuid references public.document_folders(id) on delete cascade;

alter table public.documents
  add column if not exists folder_id uuid references public.document_folders(id) on delete set null,
  add column if not exists storage_bucket text not null default 'project-documents',
  add column if not exists source_app text not null default 'ema_intelligence',
  add column if not exists source_kind text not null default 'project',
  add column if not exists source_record_id text,
  add column if not exists sha256 text,
  add column if not exists is_data_room_archive boolean not null default false,
  add column if not exists archive_entry_path text,
  add column if not exists analysis_status text not null default 'not_started',
  add column if not exists analysis_error text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'documents_source_app_check'
      and conrelid = 'public.documents'::regclass
  ) then
    alter table public.documents add constraint documents_source_app_check
      check (source_app in ('ema_intelligence', 'ema_office', 'external'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'documents_source_kind_check'
      and conrelid = 'public.documents'::regclass
  ) then
    alter table public.documents add constraint documents_source_kind_check
      check (source_kind in ('project', 'contact', 'template', 'office', 'data_room', 'data_room_entry', 'dd_report', 'partner_submission'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'documents_analysis_status_check'
      and conrelid = 'public.documents'::regclass
  ) then
    alter table public.documents add constraint documents_analysis_status_check
      check (analysis_status in ('not_started', 'queued', 'processing', 'completed', 'failed'));
  end if;
end $$;

update public.documents
set storage_bucket = coalesce(nullif(storage_bucket, ''), 'project-documents'),
    source_app = 'ema_intelligence',
    source_kind = 'project',
    source_record_id = coalesce(source_record_id, id::text)
where source_record_id is null or storage_bucket is null;

create index if not exists documents_user_created_idx
  on public.documents(user_id, is_archived, created_at desc);
create index if not exists documents_folder_id_idx
  on public.documents(folder_id) where folder_id is not null;
create index if not exists documents_source_idx
  on public.documents(source_app, source_kind, source_record_id);
create index if not exists documents_sha256_idx
  on public.documents(user_id, sha256) where sha256 is not null;
create unique index if not exists documents_active_sha256_unique_idx
  on public.documents(user_id, sha256)
  where sha256 is not null and is_archived = false;
create index if not exists document_folders_parent_id_idx
  on public.document_folders(parent_id) where parent_id is not null;

create unique index if not exists documents_source_record_unique_idx
  on public.documents(source_app, source_kind, source_record_id)
  where source_record_id is not null;

-- The legacy tables remain temporarily for rollback compatibility. Their file
-- objects stay in place and are referenced from the canonical documents table.
insert into public.documents (
  user_id, project_id, document_type, display_name, file_name, file_path,
  file_size_bytes, mime_type, folder_id, storage_bucket, source_app,
  source_kind, source_record_id, is_archived, created_at, updated_at
)
select
  td.user_id,
  null,
  case when td.category = 'nda' then 'nda'::public.document_type else 'sonstiges'::public.document_type end,
  td.display_name,
  td.file_name,
  td.file_path,
  td.file_size_bytes,
  td.mime_type,
  td.folder_id,
  'template-documents',
  'ema_intelligence',
  'template',
  td.id::text,
  td.is_archived,
  td.created_at,
  td.updated_at
from public.template_documents td
join public.profiles p on p.id = td.user_id
on conflict do nothing;

insert into public.documents (
  user_id, project_id, document_type, display_name, file_name, file_path,
  file_size_bytes, mime_type, storage_bucket, source_app, source_kind,
  source_record_id, created_at, updated_at
)
select
  cd.user_id,
  null,
  case
    when cd.document_type::text in ('expose','lageplan','netzanschluss','pachtvertrag','genehmigung','gutachten','bild','nda','loi','spa','sonstiges')
      then cd.document_type::text::public.document_type
    else 'sonstiges'::public.document_type
  end,
  cd.file_name,
  cd.file_name,
  cd.storage_path,
  cd.size_bytes,
  cd.mime_type,
  'contact-documents',
  'ema_intelligence',
  'contact',
  cd.id::text,
  cd.created_at,
  cd.created_at
from public.contact_documents cd
join public.profiles p on p.id = cd.user_id
on conflict do nothing;

create table if not exists public.dms_document_links (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  entity_type text not null check (entity_type in ('project', 'partner', 'investor', 'contact', 'organization', 'invoice', 'office_project', 'office_document')),
  entity_id text not null,
  created_at timestamptz not null default now(),
  unique(document_id, entity_type, entity_id)
);

create index if not exists dms_document_links_user_idx
  on public.dms_document_links(user_id, entity_type, entity_id);
create index if not exists dms_document_links_document_idx
  on public.dms_document_links(document_id);

insert into public.dms_document_links(document_id, user_id, entity_type, entity_id, created_at)
select d.id, da.user_id, da.entity_type, da.entity_id::text, da.created_at
from public.document_assignments da
join public.documents d
  on d.source_app = 'ema_intelligence'
 and d.source_kind = 'template'
 and d.source_record_id = da.document_id::text
on conflict do nothing;

insert into public.dms_document_links(document_id, user_id, entity_type, entity_id, created_at)
select d.id, cd.user_id, cd.entity_type, cd.entity_id::text, cd.created_at
from public.contact_documents cd
join public.documents d
  on d.source_app = 'ema_intelligence'
 and d.source_kind = 'contact'
 and d.source_record_id = cd.id::text
on conflict do nothing;

insert into public.dms_document_links(document_id, user_id, entity_type, entity_id, created_at)
select d.id, d.user_id, 'project', d.project_id::text, d.created_at
from public.documents d
where d.project_id is not null
on conflict do nothing;

create table if not exists public.dms_data_rooms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  archive_document_id uuid not null references public.documents(id) on delete restrict,
  name text not null,
  project_profile text not null default 'pv' check (project_profile in ('pv', 'bess', 'pv_bess', 'wind', 'datacenter', 'other')),
  status text not null default 'uploaded' check (status in ('uploaded', 'extracting', 'ready', 'analyzing', 'completed', 'failed')),
  file_count integer not null default 0 check (file_count >= 0),
  total_uncompressed_bytes bigint not null default 0 check (total_uncompressed_bytes >= 0),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dms_due_diligence_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  data_room_id uuid not null references public.dms_data_rooms(id) on delete cascade,
  report_document_id uuid references public.documents(id) on delete set null,
  project_profile text not null check (project_profile in ('pv', 'bess', 'pv_bess', 'wind', 'datacenter', 'other')),
  status text not null default 'queued' check (status in ('queued', 'analyzing', 'completed', 'failed')),
  assessment jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.dms_data_room_documents (
  id uuid primary key default gen_random_uuid(),
  data_room_id uuid not null references public.dms_data_rooms(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  archive_entry_path text not null,
  created_at timestamptz not null default now(),
  unique(data_room_id, document_id)
);

create index if not exists dms_data_rooms_user_created_idx
  on public.dms_data_rooms(user_id, created_at desc);
create index if not exists dms_data_rooms_project_idx
  on public.dms_data_rooms(project_id) where project_id is not null;
create index if not exists dms_due_diligence_reports_data_room_idx
  on public.dms_due_diligence_reports(data_room_id, created_at desc);
create index if not exists dms_due_diligence_reports_user_idx
  on public.dms_due_diligence_reports(user_id, created_at desc);
create index if not exists dms_data_room_documents_room_idx
  on public.dms_data_room_documents(data_room_id, created_at);
create index if not exists dms_data_room_documents_document_idx
  on public.dms_data_room_documents(document_id);

alter table public.dms_document_links enable row level security;
alter table public.dms_data_rooms enable row level security;
alter table public.dms_due_diligence_reports enable row level security;
alter table public.dms_data_room_documents enable row level security;

drop policy if exists documents_owner_all on public.documents;
create policy documents_owner_all on public.documents
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy dms_document_links_owner_all on public.dms_document_links
for all to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.documents d
    where d.id = document_id and d.user_id = (select auth.uid())
  )
);

create policy dms_data_rooms_owner_all on public.dms_data_rooms
for all to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.documents d
    where d.id = archive_document_id and d.user_id = (select auth.uid())
  )
);

create policy dms_due_diligence_reports_owner_all on public.dms_due_diligence_reports
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy dms_data_room_documents_owner_all on public.dms_data_room_documents
for all to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.dms_data_rooms r
    where r.id = data_room_id and r.user_id = (select auth.uid())
  )
  and exists (
    select 1 from public.documents d
    where d.id = document_id and d.user_id = (select auth.uid())
  )
);

grant select, insert, update, delete on public.documents to authenticated;
grant select, insert, update, delete on public.document_folders to authenticated;
grant select, insert, update, delete on public.dms_document_links to authenticated;
grant select, insert, update, delete on public.dms_data_rooms to authenticated;
grant select, insert, update, delete on public.dms_due_diligence_reports to authenticated;
grant select, insert, update, delete on public.dms_data_room_documents to authenticated;
grant all on public.documents, public.document_folders, public.dms_document_links,
  public.dms_data_rooms, public.dms_due_diligence_reports, public.dms_data_room_documents to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ema-dms',
  'ema-dms',
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
    'text/csv',
    'application/zip',
    'application/x-zip-compressed'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy ema_dms_storage_insert_own on storage.objects
for insert to authenticated
with check (
  bucket_id = 'ema-dms'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy ema_dms_storage_select_own on storage.objects
for select to authenticated
using (
  bucket_id = 'ema-dms'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy ema_dms_storage_update_own on storage.objects
for update to authenticated
using (
  bucket_id = 'ema-dms'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'ema-dms'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy ema_dms_storage_delete_own on storage.objects
for delete to authenticated
using (
  bucket_id = 'ema-dms'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create or replace function public.set_dms_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.set_dms_updated_at() from public, anon, authenticated;

drop trigger if exists dms_data_rooms_updated_at on public.dms_data_rooms;
create trigger dms_data_rooms_updated_at
before update on public.dms_data_rooms
for each row execute function public.set_dms_updated_at();

drop trigger if exists dms_due_diligence_reports_updated_at on public.dms_due_diligence_reports;
create trigger dms_due_diligence_reports_updated_at
before update on public.dms_due_diligence_reports
for each row execute function public.set_dms_updated_at();

comment on table public.documents is 'Canonical EMA DMS catalogue. One binary object may be linked to projects, contacts, investors, partners, invoices or Office records.';
comment on table public.dms_data_rooms is 'Uploaded ZIP data rooms prepared for controlled extraction and EMA due diligence.';
comment on table public.dms_due_diligence_reports is 'Persisted, evidence-backed EMA DD pre-assessments and generated report documents.';
