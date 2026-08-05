alter table public.country_project_lists
  add column if not exists total_kwp numeric not null default 0;

comment on column public.country_project_lists.total_kwp is
  'Gesamtleistung aller ausgewählten Projekte der gespeicherten Projektliste in kWp.';
