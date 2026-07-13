-- EMA 4.0 – Partner project submissions with private document storage

create table if not exists public.project_submissions (
  id uuid primary key default gen_random_uuid(),
  partner_user_id uuid not null references public.profiles(id) on delete cascade,
  project_name text not null,
  project_type text not null check (project_type in ('pv_freiflaeche', 'pv_dach', 'bess', 'hybrid')),
  location_address text,
  location_city text not null,
  location_state text,
  pv_kwp numeric(12,3) check (pv_kwp is null or pv_kwp >= 0),
  bess_mw numeric(12,3) check (bess_mw is null or bess_mw >= 0),
  bess_mwh numeric(12,3) check (bess_mwh is null or bess_mwh >= 0),
  contact_name text,
  contact_email text,
  contact_phone text,
  notes text,
  status text not null default 'eingereicht' check (
    status in ('entwurf', 'eingereicht', 'in_pruefung', 'rueckfrage', 'angenommen', 'abgelehnt')
  ),
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_project_submissions_partner_user_id
  on public.project_submissions(partner_user_id);
create index if not exists idx_project_submissions_status
  on public.project_submissions(status);
create index if not exists idx_project_submissions_created_at
  on public.project_submissions(created_at desc);

create table if not exists public.submission_documents (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.project_submissions(id) on delete cascade,
  partner_user_id uuid not null references public.profiles(id) on delete cascade,
  document_type text not null default 'sonstiges' check (
    document_type in ('expose', 'lageplan', 'netzanschluss', 'pachtvertrag', 'genehmigung', 'gutachten', 'bild', 'sonstiges')
  ),
  display_name text not null,
  file_name text not null,
  file_path text not null unique,
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0),
  mime_type text,
  created_at timestamptz not null default now()
);

create index if not exists idx_submission_documents_submission_id
  on public.submission_documents(submission_id);
create index if not exists idx_submission_documents_partner_user_id
  on public.submission_documents(partner_user_id);

alter table public.project_submissions enable row level security;
alter table public.submission_documents enable row level security;

create policy "partner_submissions_select_own"
  on public.project_submissions for select
  to authenticated
  using ((select auth.uid()) = partner_user_id);

create policy "partner_submissions_insert_own"
  on public.project_submissions for insert
  to authenticated
  with check (
    (select auth.uid()) = partner_user_id
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and lower(p.role) in ('partner', 'sales_partner', 'vertriebspartner')
    )
  );

-- Only used to clean up a failed upload immediately after creation.
create policy "partner_submissions_delete_recent_own"
  on public.project_submissions for delete
  to authenticated
  using (
    (select auth.uid()) = partner_user_id
    and created_at > now() - interval '15 minutes'
    and status = 'eingereicht'
  );

create policy "ema_admin_submissions_select_all"
  on public.project_submissions for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and lower(p.role) in ('admin', 'owner')
    )
  );

create policy "ema_admin_submissions_update_all"
  on public.project_submissions for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and lower(p.role) in ('admin', 'owner')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and lower(p.role) in ('admin', 'owner')
    )
  );

create policy "partner_submission_documents_select_own"
  on public.submission_documents for select
  to authenticated
  using ((select auth.uid()) = partner_user_id);

create policy "partner_submission_documents_insert_own"
  on public.submission_documents for insert
  to authenticated
  with check (
    (select auth.uid()) = partner_user_id
    and exists (
      select 1 from public.project_submissions s
      where s.id = submission_id
        and s.partner_user_id = (select auth.uid())
    )
  );

create policy "ema_admin_submission_documents_select_all"
  on public.submission_documents for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and lower(p.role) in ('admin', 'owner')
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'partner-submissions',
  'partner-submissions',
  false,
  26214400,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "partners_upload_own_submission_files"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'partner-submissions'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and lower(p.role) in ('partner', 'sales_partner', 'vertriebspartner')
    )
  );

create policy "partners_read_own_submission_files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'partner-submissions'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "partners_delete_own_submission_files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'partner-submissions'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "ema_admin_read_all_submission_files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'partner-submissions'
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and lower(p.role) in ('admin', 'owner')
    )
  );
