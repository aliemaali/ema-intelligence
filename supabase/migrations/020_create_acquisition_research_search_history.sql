create table if not exists public.acquisition_research_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  location text not null,
  location_key text not null,
  radius_km integer not null check (radius_km between 1 and 50),
  category text not null check (category in ('all','logistics','industry')),
  found_count integer not null default 0,
  added_count integer not null default 0,
  status text not null default 'success' check (status in ('success','failed')),
  last_searched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, location_key, radius_km, category)
);

alter table public.acquisition_research_searches enable row level security;

drop policy if exists "Users manage own research searches" on public.acquisition_research_searches;
create policy "Users manage own research searches"
on public.acquisition_research_searches
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index if not exists acquisition_research_searches_user_last_idx
on public.acquisition_research_searches (user_id, last_searched_at desc);
