alter table public.acquisition_research_candidates
  add column if not exists industry text,
  add column if not exists contact_url text,
  add column if not exists enrichment_status text not null default 'pending',
  add column if not exists enrichment_error text,
  add column if not exists enrichment_sources jsonb not null default '[]'::jsonb,
  add column if not exists enriched_at timestamptz;

alter table public.acquisition_research_candidates
  drop constraint if exists acquisition_research_candidates_enrichment_status_check;

alter table public.acquisition_research_candidates
  add constraint acquisition_research_candidates_enrichment_status_check
  check (enrichment_status in ('pending', 'running', 'completed', 'failed', 'skipped'));

create index if not exists acquisition_research_candidates_enrichment_idx
  on public.acquisition_research_candidates(user_id, enrichment_status, created_at desc);
