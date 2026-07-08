-- EMA Intelligence – Security hardening
-- Enables Row Level Security (RLS) and owner-based policies for all app tables.
-- Safe to run multiple times.

-- -----------------------------------------------------------------------------
-- Profiles: one profile row belongs to the authenticated user via profiles.id
-- -----------------------------------------------------------------------------

do $$
begin
  if to_regclass('public.profiles') is not null then
    alter table public.profiles enable row level security;

    drop policy if exists "profiles_select_own" on public.profiles;
    drop policy if exists "profiles_insert_own" on public.profiles;
    drop policy if exists "profiles_update_own" on public.profiles;
    drop policy if exists "profiles_delete_own" on public.profiles;

    create policy "profiles_select_own"
      on public.profiles
      for select
      to authenticated
      using (id = auth.uid());

    create policy "profiles_insert_own"
      on public.profiles
      for insert
      to authenticated
      with check (id = auth.uid());

    create policy "profiles_update_own"
      on public.profiles
      for update
      to authenticated
      using (id = auth.uid())
      with check (id = auth.uid());

    create policy "profiles_delete_own"
      on public.profiles
      for delete
      to authenticated
      using (id = auth.uid());
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Helper for standard user-owned tables with a user_id column
-- -----------------------------------------------------------------------------

do $$
declare
  table_name text;
  policy_prefix text;
  tables text[] := array[
    'partners',
    'investors',
    'projects',
    'deals',
    'expenses',
    'documents',
    'tasks',
    'activity_log',
    'external_commissions',
    'ai_outputs'
  ];
begin
  foreach table_name in array tables loop
    if to_regclass(format('public.%I', table_name)) is not null
       and exists (
         select 1
         from information_schema.columns
         where table_schema = 'public'
           and table_name = table_name
           and column_name = 'user_id'
       ) then

      execute format('alter table public.%I enable row level security', table_name);

      policy_prefix := table_name;

      execute format('drop policy if exists %L on public.%I', policy_prefix || '_select_own', table_name);
      execute format('drop policy if exists %L on public.%I', policy_prefix || '_insert_own', table_name);
      execute format('drop policy if exists %L on public.%I', policy_prefix || '_update_own', table_name);
      execute format('drop policy if exists %L on public.%I', policy_prefix || '_delete_own', table_name);

      execute format(
        'create policy %I on public.%I for select to authenticated using (user_id = auth.uid())',
        policy_prefix || '_select_own', table_name
      );

      execute format(
        'create policy %I on public.%I for insert to authenticated with check (user_id = auth.uid())',
        policy_prefix || '_insert_own', table_name
      );

      execute format(
        'create policy %I on public.%I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())',
        policy_prefix || '_update_own', table_name
      );

      execute format(
        'create policy %I on public.%I for delete to authenticated using (user_id = auth.uid())',
        policy_prefix || '_delete_own', table_name
      );
    end if;
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- Storage objects: keep user uploads private by folder prefix user_id/...
-- This only applies if Supabase Storage is used.
-- -----------------------------------------------------------------------------

do $$
begin
  if to_regclass('storage.objects') is not null then
    alter table storage.objects enable row level security;

    drop policy if exists "storage_select_own_folder" on storage.objects;
    drop policy if exists "storage_insert_own_folder" on storage.objects;
    drop policy if exists "storage_update_own_folder" on storage.objects;
    drop policy if exists "storage_delete_own_folder" on storage.objects;

    create policy "storage_select_own_folder"
      on storage.objects
      for select
      to authenticated
      using ((storage.foldername(name))[1] = auth.uid()::text);

    create policy "storage_insert_own_folder"
      on storage.objects
      for insert
      to authenticated
      with check ((storage.foldername(name))[1] = auth.uid()::text);

    create policy "storage_update_own_folder"
      on storage.objects
      for update
      to authenticated
      using ((storage.foldername(name))[1] = auth.uid()::text)
      with check ((storage.foldername(name))[1] = auth.uid()::text);

    create policy "storage_delete_own_folder"
      on storage.objects
      for delete
      to authenticated
      using ((storage.foldername(name))[1] = auth.uid()::text);
  end if;
end $$;
