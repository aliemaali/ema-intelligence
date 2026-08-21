-- Share accepted PLAUD tasks and appointments between the two EMA team accounts.
-- Notes, recordings, transcripts and OAuth/import data remain private.

alter table public.plaud_items
  add column if not exists team_shared boolean not null default false;

-- Existing accepted/open and completed entries become team-visible.
update public.plaud_items
set team_shared = true
where status in ('open', 'completed');

-- New accepted items are shared automatically; suggested/rejected items stay private.
create or replace function public.set_plaud_item_team_shared()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status in ('open', 'completed') then
    new.team_shared := true;
  elsif tg_op = 'INSERT' then
    new.team_shared := false;
  end if;
  return new;
end;
$$;

revoke all on function public.set_plaud_item_team_shared() from public;

drop trigger if exists plaud_items_set_team_shared on public.plaud_items;
create trigger plaud_items_set_team_shared
before insert or update of status on public.plaud_items
for each row execute function public.set_plaud_item_team_shared();

-- Keep notes and raw PLAUD data on their existing owner-only policies.
-- Only Ali and Tuba may read shared task/appointment rows.
drop policy if exists plaud_items_owner on public.plaud_items;
drop policy if exists plaud_items_select_team on public.plaud_items;
drop policy if exists plaud_items_insert_owner on public.plaud_items;
drop policy if exists plaud_items_update_team on public.plaud_items;
drop policy if exists plaud_items_delete_owner on public.plaud_items;

create policy plaud_items_select_team on public.plaud_items
for select to authenticated
using (
  (select auth.uid()) = user_id
  or (
    team_shared = true
    and (select auth.uid()) in (
      '028abbe8-ddbd-4010-a278-3d5b34b592be'::uuid,
      '0c62c36b-982d-4830-ac5d-9e6af92c39ae'::uuid
    )
    and user_id in (
      '028abbe8-ddbd-4010-a278-3d5b34b592be'::uuid,
      '0c62c36b-982d-4830-ac5d-9e6af92c39ae'::uuid
    )
  )
);

create policy plaud_items_insert_owner on public.plaud_items
for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy plaud_items_update_team on public.plaud_items
for update to authenticated
using (
  (select auth.uid()) = user_id
  or (
    team_shared = true
    and (select auth.uid()) in (
      '028abbe8-ddbd-4010-a278-3d5b34b592be'::uuid,
      '0c62c36b-982d-4830-ac5d-9e6af92c39ae'::uuid
    )
    and user_id in (
      '028abbe8-ddbd-4010-a278-3d5b34b592be'::uuid,
      '0c62c36b-982d-4830-ac5d-9e6af92c39ae'::uuid
    )
  )
)
with check (
  user_id in (
    '028abbe8-ddbd-4010-a278-3d5b34b592be'::uuid,
    '0c62c36b-982d-4830-ac5d-9e6af92c39ae'::uuid
  )
);

create policy plaud_items_delete_owner on public.plaud_items
for delete to authenticated
using ((select auth.uid()) = user_id);

create index if not exists plaud_items_team_shared_status_due_idx
  on public.plaud_items (team_shared, status, due_at)
  where team_shared = true;
