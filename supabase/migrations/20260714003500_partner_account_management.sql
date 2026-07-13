-- EMA 4.0 – Partner account management

alter table public.profiles
  add column if not exists is_active boolean not null default true;

create index if not exists idx_profiles_partner_accounts
  on public.profiles (role, is_active)
  where lower(role) in ('partner', 'sales_partner', 'vertriebspartner');
