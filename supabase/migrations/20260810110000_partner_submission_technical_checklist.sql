alter table public.project_submissions
  add column if not exists technical_checklist jsonb not null default '{}'::jsonb;

comment on column public.project_submissions.technical_checklist is
  'Structured PV/BESS checklist supplied by the submitting partner.';
