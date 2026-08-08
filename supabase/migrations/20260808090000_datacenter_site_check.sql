alter table public.projects
  add column if not exists data_center_grid_confirmed boolean not null default false,
  add column if not exists data_center_site_check jsonb not null default '{}'::jsonb;

comment on column public.projects.data_center_grid_confirmed is
  'True only when the stored data_center_grid_mw has been verified by evidence.';

comment on column public.projects.data_center_site_check is
  'Structured data-center site screening based on the EMA Site Information Sheet.';

-- Preserve the existing admin portfolio visibility when the view below runs
-- with the querying user's RLS permissions.
drop policy if exists projects_admin_select on public.projects;
create policy projects_admin_select
on public.projects
for select
to authenticated
using (public.is_admin_or_owner());

create or replace view public.v_projects_with_deals
with (security_invoker = true)
as
select
  p.id,
  case when public.is_admin_or_owner() then auth.uid() else p.user_id end as user_id,
  p.partner_id,
  p.project_number,
  p.project_name,
  p.project_type,
  p.status,
  p.priority,
  p.marketing_status,
  p.contact_name,
  p.contact_email,
  p.contact_phone,
  p.location_address,
  p.location_city,
  p.location_state,
  p.location_country,
  p.location_lat,
  p.location_lng,
  p.pv_mwp,
  p.pv_ac_mw,
  p.bess_mw,
  p.bess_mwh,
  p.bess_duration_h,
  p.hybrid_config,
  p.dev_status,
  p.ai_score,
  p.ai_score_details,
  p.ai_last_analyzed,
  p.notes,
  p.tags,
  p.last_activity_at,
  p.is_archived,
  p.created_at,
  p.updated_at,
  d.id as deal_id,
  d.deal_number,
  d.deal_status,
  d.purchase_price as deal_purchase_price,
  d.sales_price as deal_sales_price,
  d.gross_margin as deal_gross_margin,
  d.net_profit as deal_net_profit,
  d.margin_type as deal_margin_type,
  d.margin_value as deal_margin_value,
  pa.company as partner_company,
  pa.full_name as partner_name,
  p.feed_in_type,
  p.feed_in_tariff_ct_kwh,
  p.specific_yield_kwh_kwp,
  p.annual_yield_kwh,
  p.values_verified_at,
  p.values_verified_by,
  p.project_stage,
  p.lease_term_years,
  p.project_image_url,
  p.investment_volume_eur,
  p.data_center_grid_mw,
  p.data_center_it_mw,
  p.land_area_sqm,
  p.transformer_status,
  p.data_center_status,
  p.data_center_grid_confirmed,
  p.data_center_site_check,
  p.customer_intake,
  p.source_metadata,
  p.output_metadata,
  p.master_data_version,
  p.master_data_updated_at
from public.projects p
left join public.deals d on d.project_id = p.id and d.is_active = true
left join public.partners pa on pa.id = p.partner_id;

grant select on public.v_projects_with_deals to authenticated;
revoke all on public.v_projects_with_deals from anon;
