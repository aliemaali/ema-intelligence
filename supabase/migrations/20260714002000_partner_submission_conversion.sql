-- EMA 4.0 – Track conversion of accepted partner submissions

alter table public.project_submissions
  add column if not exists converted_project_id uuid references public.projects(id) on delete set null,
  add column if not exists converted_at timestamptz,
  add column if not exists converted_by uuid references public.profiles(id) on delete set null;

create unique index if not exists idx_project_submissions_converted_project_id
  on public.project_submissions(converted_project_id)
  where converted_project_id is not null;
