create or replace function public.is_admin_or_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and lower(coalesce(role, '')) in ('admin', 'owner')
  );
$$;

revoke all on function public.is_admin_or_owner() from public;
grant execute on function public.is_admin_or_owner() to authenticated;

drop policy if exists profiles_admin_select on public.profiles;
create policy profiles_admin_select
on public.profiles
for select
to authenticated
using (public.is_admin_or_owner());

drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update
on public.profiles
for update
to authenticated
using (public.is_admin_or_owner())
with check (public.is_admin_or_owner());
