create table if not exists public.plaud_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  external_id text not null,
  kind text not null check (kind in ('task','appointment')),
  title text not null,
  detail text,
  source text,
  status text not null default 'suggested' check (status in ('suggested','open','completed','rejected')),
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id,external_id)
);

alter table public.plaud_items add column if not exists due_at timestamptz;

create table if not exists public.plaud_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  external_id text not null,
  title text not null,
  recorded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (user_id,external_id)
);

alter table public.plaud_notes add column if not exists archived_at timestamptz;

create index if not exists plaud_items_user_status_due_idx on public.plaud_items (user_id,status,due_at);
create index if not exists plaud_notes_user_archived_idx on public.plaud_notes (user_id,archived_at);

alter table public.plaud_items enable row level security;
alter table public.plaud_notes enable row level security;

drop policy if exists plaud_items_owner on public.plaud_items;
create policy plaud_items_owner on public.plaud_items
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists plaud_notes_owner on public.plaud_notes;
create policy plaud_notes_owner on public.plaud_notes
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

revoke all on public.plaud_items from anon;
revoke all on public.plaud_notes from anon;
grant select,insert,update,delete on public.plaud_items to authenticated;
grant select,insert,update,delete on public.plaud_notes to authenticated;

update public.plaud_items set due_at = case external_id
  when 'followup' then '2026-08-26T09:00:00+02:00'::timestamptz
  when 'nda' then '2026-08-23T12:00:00+02:00'::timestamptz
  when 'teaser' then '2026-08-27T12:00:00+02:00'::timestamptz
  else due_at
end
where due_at is null and external_id in ('followup','nda','teaser');
