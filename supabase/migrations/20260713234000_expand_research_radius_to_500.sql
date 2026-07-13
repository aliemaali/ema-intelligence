alter table public.acquisition_research_searches
  drop constraint if exists acquisition_research_searches_radius_km_check;

alter table public.acquisition_research_searches
  add constraint acquisition_research_searches_radius_km_check
  check (radius_km between 1 and 500);
