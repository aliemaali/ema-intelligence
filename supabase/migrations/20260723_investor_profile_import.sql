alter table public.investors
  add column if not exists position_title text,
  add column if not exists search_profile jsonb not null default '{}'::jsonb,
  add column if not exists profile_imported_at timestamptz,
  add column if not exists profile_source text;

comment on column public.investors.position_title is 'Position or title of the primary investor contact.';
comment on column public.investors.search_profile is 'Structured criteria imported from the EMA investor search profile PDF.';
comment on column public.investors.profile_imported_at is 'Timestamp of the latest investor profile PDF import.';
comment on column public.investors.profile_source is 'Source used to create or update the structured investor profile.';

create or replace view public.investors_with_stats as
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
  0 as linked_projects_count,
  null::timestamptz as last_note_at,
  i.position_title,
  i.search_profile,
  i.profile_imported_at,
  i.profile_source
from public.investors i;

alter view public.investors_with_stats set (security_invoker = true);
grant select on public.investors_with_stats to authenticated;
