alter table public.project_submissions
  drop constraint if exists project_submissions_status_check;

alter table public.project_submissions
  add constraint project_submissions_status_check
  check (status = any (array[
    'entwurf'::text,
    'eingereicht'::text,
    'in_pruefung'::text,
    'rueckfrage'::text,
    'angenommen'::text,
    'abgelehnt'::text,
    'archiviert'::text
  ]));
