-- EMA Scout – Sprint 3 Job Engine

create table if not exists public.agent_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  prompt text not null,
  job_type text not null check (job_type in ('roof_search','project_search','lead_scoring','email_drafting','other')),
  status text not null default 'queued' check (status in ('queued','planning','researching','analyzing','creating_leads','drafting_emails','waiting_approval','completed','failed','cancelled')),
  progress integer not null default 0 check (progress between 0 and 100),
  current_step text,
  result_summary jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.agent_jobs(id) on delete cascade,
  level text not null default 'info' check (level in ('info','success','warning','error')),
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.agent_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.agent_jobs(id) on delete cascade,
  result_type text not null check (result_type in ('lead','project','roof','recommendation','email_draft')),
  title text not null,
  score integer check (score between 0 and 100),
  payload jsonb not null default '{}'::jsonb,
  acquisition_lead_id uuid references public.acquisition_leads(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists agent_jobs_user_status_idx on public.agent_jobs(user_id, status);
create index if not exists agent_logs_job_created_idx on public.agent_logs(job_id, created_at);
create index if not exists agent_results_job_idx on public.agent_results(job_id);

alter table public.agent_jobs enable row level security;
alter table public.agent_logs enable row level security;
alter table public.agent_results enable row level security;

create policy "Users manage own agent jobs" on public.agent_jobs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own agent logs" on public.agent_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own agent results" on public.agent_results for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists set_agent_jobs_updated_at on public.agent_jobs;
create trigger set_agent_jobs_updated_at before update on public.agent_jobs for each row execute function public.set_acquisition_updated_at();