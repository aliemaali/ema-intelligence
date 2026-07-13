-- EMA 4.0 – Partner map location and EEG / PPA remuneration

alter table public.project_submissions
  add column if not exists location_lat numeric(10,7),
  add column if not exists location_lng numeric(10,7),
  add column if not exists remuneration_model text,
  add column if not exists remuneration_ct_kwh numeric(10,4),
  add column if not exists ppa_term_years numeric(5,2);

alter table public.project_submissions
  drop constraint if exists project_submissions_remuneration_model_check;

alter table public.project_submissions
  add constraint project_submissions_remuneration_model_check
  check (
    remuneration_model is null
    or remuneration_model in ('ppa', 'volleinspeisung', 'teileinspeisung')
  );

alter table public.project_submissions
  drop constraint if exists project_submissions_remuneration_ct_kwh_check;

alter table public.project_submissions
  add constraint project_submissions_remuneration_ct_kwh_check
  check (remuneration_ct_kwh is null or remuneration_ct_kwh >= 0);

alter table public.project_submissions
  drop constraint if exists project_submissions_ppa_term_years_check;

alter table public.project_submissions
  add constraint project_submissions_ppa_term_years_check
  check (ppa_term_years is null or ppa_term_years >= 0);

create index if not exists idx_project_submissions_location
  on public.project_submissions(location_lat, location_lng);
