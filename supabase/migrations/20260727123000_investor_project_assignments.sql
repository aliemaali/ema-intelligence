create table if not exists public.investor_project_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  investor_id uuid not null references public.investors(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  status text not null default 'vorgemerkt' check (status in ('vorgemerkt','expose_versendet','interesse','kein_interesse','rueckmeldung_offen')),
  expose_sent_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, investor_id, project_id)
);

create index if not exists investor_project_assignments_user_idx on public.investor_project_assignments(user_id);
create index if not exists investor_project_assignments_investor_idx on public.investor_project_assignments(investor_id);
create index if not exists investor_project_assignments_project_idx on public.investor_project_assignments(project_id);

alter table public.investor_project_assignments enable row level security;

create policy "Users manage own investor project assignments"
on public.investor_project_assignments
for all to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.investors i where i.id = investor_id and i.user_id = (select auth.uid()))
  and exists (select 1 from public.projects p where p.id = project_id and p.user_id = (select auth.uid()))
);

create or replace function public.set_investor_project_assignments_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists investor_project_assignments_updated_at on public.investor_project_assignments;
create trigger investor_project_assignments_updated_at
before update on public.investor_project_assignments
for each row execute function public.set_investor_project_assignments_updated_at();
