alter table public.projects
  add column if not exists project_stage text,
  add column if not exists lease_term_years numeric,
  add column if not exists project_image_url text;

update public.projects
set project_stage = case
  when data_center_status = 'rtb' then 'rtb'
  when status::text = 'verkauft' then 'betrieb'
  else 'planung'
end
where project_stage is null or btrim(project_stage) = '';

alter table public.projects
  drop constraint if exists projects_project_stage_check;

alter table public.projects
  add constraint projects_project_stage_check
  check (project_stage is null or project_stage in ('planung', 'rtb', 'betrieb'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-images',
  'project-images',
  true,
  8388608,
  array['image/png','image/jpeg','image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Authenticated users can upload project images" on storage.objects;
create policy "Authenticated users can upload project images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'project-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Authenticated users can update project images" on storage.objects;
create policy "Authenticated users can update project images"
on storage.objects for update
to authenticated
using (bucket_id = 'project-images' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'project-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Authenticated users can delete project images" on storage.objects;
create policy "Authenticated users can delete project images"
on storage.objects for delete
to authenticated
using (bucket_id = 'project-images' and (storage.foldername(name))[1] = auth.uid()::text);