alter table public.investors
  add column if not exists website text,
  add column if not exists country text,
  add column if not exists logo_url text;

create or replace view public.investors_with_stats
with (security_invoker = true)
as
select
  i.*,
  count(distinct l.id)::integer as project_count,
  count(distinct n.id)::integer as note_count
from public.investors i
left join public.investor_project_links l on l.investor_id = i.id
left join public.investor_notes n on n.investor_id = i.id
group by i.id;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'investor-logos',
  'investor-logos',
  true,
  2097152,
  array['image/png','image/jpeg','image/webp','image/svg+xml']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Authenticated users can upload investor logos" on storage.objects;
create policy "Authenticated users can upload investor logos"
on storage.objects for insert
to authenticated
with check (bucket_id = 'investor-logos');

drop policy if exists "Authenticated users can update investor logos" on storage.objects;
create policy "Authenticated users can update investor logos"
on storage.objects for update
to authenticated
using (bucket_id = 'investor-logos')
with check (bucket_id = 'investor-logos');

drop policy if exists "Authenticated users can delete investor logos" on storage.objects;
create policy "Authenticated users can delete investor logos"
on storage.objects for delete
to authenticated
using (bucket_id = 'investor-logos');
