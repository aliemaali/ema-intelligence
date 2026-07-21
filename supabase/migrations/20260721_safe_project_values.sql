alter table public.projects
  add column if not exists feed_in_type text,
  add column if not exists feed_in_tariff_ct_kwh numeric,
  add column if not exists specific_yield_kwh_kwp numeric,
  add column if not exists annual_yield_kwh numeric,
  add column if not exists values_verified_at timestamptz,
  add column if not exists values_verified_by uuid references auth.users(id);

create or replace view public.v_projects_with_deals as
select
  p.id, p.user_id, p.partner_id, p.project_number, p.project_name, p.project_type,
  p.status, p.priority, p.marketing_status, p.contact_name, p.contact_email,
  p.contact_phone, p.location_address, p.location_city, p.location_state,
  p.location_country, p.location_lat, p.location_lng, p.pv_mwp, p.pv_ac_mw,
  p.bess_mw, p.bess_mwh, p.bess_duration_h, p.hybrid_config, p.dev_status,
  p.ai_score, p.ai_score_details, p.ai_last_analyzed, p.notes, p.tags,
  p.last_activity_at, p.is_archived, p.created_at, p.updated_at,
  p.feed_in_type, p.feed_in_tariff_ct_kwh, p.specific_yield_kwh_kwp,
  p.annual_yield_kwh, p.values_verified_at, p.values_verified_by,
  d.id as deal_id, d.deal_number, d.deal_status,
  d.purchase_price as deal_purchase_price, d.sales_price as deal_sales_price,
  d.gross_margin as deal_gross_margin, d.net_profit as deal_net_profit,
  d.margin_type as deal_margin_type, d.margin_value as deal_margin_value,
  pa.company as partner_company, pa.full_name as partner_name
from public.projects p
left join public.deals d on d.project_id = p.id and d.is_active = true
left join public.partners pa on pa.id = p.partner_id;

grant select on public.v_projects_with_deals to authenticated;
