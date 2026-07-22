do $$
begin
  alter type project_type add value if not exists 'rechenzentrum';
  alter type project_type add value if not exists 'sonstiges';
exception
  when undefined_object then null;
end $$;

do $$
begin
  alter type margin_type add value if not exists 'included_per_kwp';
exception
  when undefined_object then null;
end $$;

alter table public.projects
  add column if not exists data_center_grid_mw numeric,
  add column if not exists data_center_it_mw numeric,
  add column if not exists land_area_sqm numeric,
  add column if not exists transformer_status text,
  add column if not exists data_center_status text;

alter table public.deals
  add column if not exists purchase_price_type text not null default 'total',
  add column if not exists included_margin_per_kwp numeric;

alter table public.deals
  drop constraint if exists deals_purchase_price_type_check;

alter table public.deals
  add constraint deals_purchase_price_type_check
  check (purchase_price_type in ('total', 'per_kwp'));

alter table public.projects
  drop constraint if exists projects_data_center_status_check;

alter table public.projects
  add constraint projects_data_center_status_check
  check (data_center_status is null or data_center_status in ('in_entwicklung', 'rtb'));

comment on column public.projects.data_center_grid_mw is 'Elektrische Anschlussleistung des Rechenzentrums in MW';
comment on column public.projects.data_center_it_mw is 'IT-Leistung des Rechenzentrums in MW';
comment on column public.projects.land_area_sqm is 'Grundstücksfläche in Quadratmetern';
comment on column public.projects.transformer_status is 'Status Transformator oder Umspannwerk';
comment on column public.projects.data_center_status is 'Rechenzentrum-Status: in_entwicklung oder rtb';
comment on column public.deals.purchase_price_type is 'EK-Berechnung: total oder per_kwp';
comment on column public.deals.included_margin_per_kwp is 'Bereits im EK enthaltene Marge in Euro pro kWp';
