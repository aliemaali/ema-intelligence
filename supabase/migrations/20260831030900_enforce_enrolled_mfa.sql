create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create or replace function private.mfa_verified_or_not_enrolled()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, auth
as $$
  select
    not exists (
      select 1
      from auth.mfa_factors
      where user_id = auth.uid()
        and status = 'verified'
    )
    or coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;

revoke all on function private.mfa_verified_or_not_enrolled() from public, anon;
grant execute on function private.mfa_verified_or_not_enrolled() to authenticated, service_role;

-- A user without MFA keeps normal access. As soon as a verified factor exists,
-- every public-table request must carry an AAL2 session.
do $$
declare
  target record;
begin
  for target in
    select n.nspname as schema_name, c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and c.relrowsecurity
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      'Require verified MFA when enrolled',
      target.schema_name,
      target.table_name
    );
    execute format(
      'create policy %I on %I.%I as restrictive for all to authenticated using (private.mfa_verified_or_not_enrolled()) with check (private.mfa_verified_or_not_enrolled())',
      'Require verified MFA when enrolled',
      target.schema_name,
      target.table_name
    );
  end loop;
end;
$$;

drop policy if exists "Require verified MFA when enrolled" on storage.objects;
create policy "Require verified MFA when enrolled"
on storage.objects
as restrictive
for all
to authenticated
using (private.mfa_verified_or_not_enrolled())
with check (private.mfa_verified_or_not_enrolled());
