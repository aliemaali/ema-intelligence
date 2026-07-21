alter table public.partners
  add column if not exists category text not null default 'Vertriebspartner';

update public.partners
set category = 'Vertriebspartner'
where category is null or btrim(category) = '';

comment on column public.partners.category is 'Partnerart, z. B. Vertriebspartner, EPC, Projektentwickler oder Sonstige';
