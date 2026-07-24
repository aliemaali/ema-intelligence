alter table public.investors
  add column if not exists website text,
  add column if not exists country text,
  add column if not exists logo_url text;

update public.investors
set country = coalesce(nullif(country, ''), nullif(location_country, ''))
where country is null or country = '';

update public.investors
set website = 'https://' || split_part(lower(email), '@', 2)
where (website is null or website = '')
  and email like '%@%'
  and split_part(lower(email), '@', 2) not in (
    'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com',
    'icloud.com', 'me.com', 'yahoo.com', 'gmx.de', 'gmx.net', 'web.de', 't-online.de'
  );

create or replace function public.infer_investor_identity_fields()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  email_domain text;
begin
  if (new.country is null or btrim(new.country) = '') and new.location_country is not null then
    new.country := nullif(btrim(new.location_country), '');
  end if;

  if (new.website is null or btrim(new.website) = '') and new.email like '%@%' then
    email_domain := split_part(lower(new.email), '@', 2);
    if email_domain not in (
      'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com',
      'icloud.com', 'me.com', 'yahoo.com', 'gmx.de', 'gmx.net', 'web.de', 't-online.de'
    ) then
      new.website := 'https://' || email_domain;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists investors_infer_identity_fields on public.investors;
create trigger investors_infer_identity_fields
before insert or update of email, website, country, location_country
on public.investors
for each row execute function public.infer_investor_identity_fields();

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
