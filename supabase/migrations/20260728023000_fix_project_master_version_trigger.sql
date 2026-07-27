-- Dokument-Metadaten sind Ausgaben und dürfen die zugrunde liegende
-- Projektdaten-Version nicht selbst erhöhen.
create or replace function public.touch_project_master_data()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  old_master jsonb;
  new_master jsonb;
begin
  old_master := to_jsonb(old) - array[
    'output_metadata',
    'master_data_version',
    'master_data_updated_at',
    'last_activity_at',
    'updated_at'
  ];
  new_master := to_jsonb(new) - array[
    'output_metadata',
    'master_data_version',
    'master_data_updated_at',
    'last_activity_at',
    'updated_at'
  ];

  if old_master is distinct from new_master then
    new.master_data_version := coalesce(old.master_data_version, 0) + 1;
    new.master_data_updated_at := now();
  else
    new.master_data_version := old.master_data_version;
    new.master_data_updated_at := old.master_data_updated_at;
  end if;

  return new;
end;
$$;
