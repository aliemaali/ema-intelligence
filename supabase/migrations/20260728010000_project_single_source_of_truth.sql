-- EMA Project Single Source of Truth
-- Alle Eingabe- und Ausgabe-Werkzeuge beziehen sich künftig auf genau einen projects-Datensatz.

alter table public.projects
  add column if not exists customer_intake jsonb not null default '{}'::jsonb,
  add column if not exists source_metadata jsonb not null default '{}'::jsonb,
  add column if not exists output_metadata jsonb not null default '{}'::jsonb,
  add column if not exists master_data_version integer not null default 1,
  add column if not exists master_data_updated_at timestamptz not null default now();

comment on column public.projects.customer_intake is
  'Strukturierte Zusatzdaten aus der Kunden-/Projektaufnahme; keine eigenständige Datenquelle.';
comment on column public.projects.source_metadata is
  'Nachvollziehbare Herkunft einzelner Projektwerte, z. B. Aufnahmebogen, Import oder manuelle Pflege.';
comment on column public.projects.output_metadata is
  'Metadaten zuletzt erzeugter Ausgaben wie Investment Memorandum, Projektaufnahmebogen oder Akquisebogen.';
comment on column public.projects.master_data_version is
  'Erhöht sich bei Änderungen der zentralen Projektdaten und ermöglicht veraltete Dokumente zu erkennen.';

create or replace function public.touch_project_master_data()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.master_data_version := coalesce(old.master_data_version, 0) + 1;
  new.master_data_updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_project_master_data on public.projects;
create trigger trg_touch_project_master_data
before update on public.projects
for each row
when (old is distinct from new)
execute function public.touch_project_master_data();

create index if not exists idx_projects_master_data_updated_at
  on public.projects(master_data_updated_at desc);
