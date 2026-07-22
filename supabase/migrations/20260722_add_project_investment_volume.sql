alter table public.projects
  add column if not exists investment_volume_eur numeric;

comment on column public.projects.investment_volume_eur is
  'Geplantes Investitionsvolumen des Projekts in Euro';
