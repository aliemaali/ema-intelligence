create or replace function private.is_admin_or_owner()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and lower(coalesce(role, '')) in ('admin', 'owner')
  );
$$;

revoke all on function private.is_admin_or_owner() from public, anon;
grant execute on function private.is_admin_or_owner() to authenticated, service_role;

-- Keep the existing policy/view API stable, but make the public wrapper an
-- invoker function. The privileged lookup itself is no longer exposed by REST.
create or replace function public.is_admin_or_owner()
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog, private
as $$
  select private.is_admin_or_owner();
$$;

revoke all on function public.is_admin_or_owner() from public, anon;
grant execute on function public.is_admin_or_owner() to authenticated, service_role;
