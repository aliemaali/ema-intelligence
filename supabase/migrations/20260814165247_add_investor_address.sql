alter table public.investors
  add column if not exists street_address text,
  add column if not exists postal_code text;

comment on column public.investors.street_address is 'Street and house number of the investor company address.';
comment on column public.investors.postal_code is 'Postal code of the investor company address.';

create or replace view public.investors_with_stats
with (security_invoker = true)
as
select
  i.id,
  i.user_id,
  i.full_name,
  i.company,
  i.email,
  i.phone,
  i.website,
  i.location_city,
  i.location_country,
  i.interest_pv,
  i.interest_bess,
  i.interest_hybrid,
  i.interest_wind,
  i.size_preferences,
  i.investment_type,
  i.min_ticket_eur,
  i.max_ticket_eur,
  i.dd_ready,
  i.last_contact,
  i.notes,
  i.is_active,
  i.created_at,
  i.updated_at,
  i.company_name,
  i.contact_person,
  i.ticket_size_min_eur,
  i.ticket_size_max_eur,
  i.focus,
  i.status,
  i.last_contact_at,
  i.next_contact_at,
  i.updated_by,
  i.created_by,
  i.position_title,
  i.search_profile,
  i.profile_imported_at,
  i.profile_source,
  i.country,
  i.logo_url,
  count(distinct pi.id)::integer as project_count,
  0 as note_count,
  i.street_address,
  i.postal_code
from public.investors i
left join public.project_investors pi on pi.investor_id = i.id
group by i.id;

grant select on public.investors_with_stats to authenticated;
