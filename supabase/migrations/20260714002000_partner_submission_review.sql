-- EMA 4.0 – Internal review fields for partner submissions
alter table public.project_submissions
  add column if not exists review_note text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null;

create index if not exists idx_project_submissions_reviewed_by
  on public.project_submissions(reviewed_by);
