alter table public.capex_calculations
  add column if not exists component_pricing jsonb not null default '{}'::jsonb;

comment on column public.capex_calculations.component_pricing is
  'Internal CAPEX component selection, price research and source URLs. Source URLs are not exported to Exposes or PDFs.';
