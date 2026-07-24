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

create or replace view public.v_projects_with_deals
with (security_invoker = true)
as
select
  p.id,
  p.user_id,
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
  p.data_center_status
from public.projects p
left join public.deals d on d.project_id = p.id and d.is_active = true
left join public.partners pa on pa.id = p.partner_id;

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