-- Eine einzige Quelle für Investor-Projekt-Zuordnungen.
-- Vorhandene Verknüpfungen aus investor_project_links werden verlustfrei
-- in investor_project_assignments übernommen. Bestehende Statuswerte bleiben erhalten.

insert into public.investor_project_assignments (
  user_id,
  investor_id,
  project_id,
  status,
  created_at,
  updated_at
)
select
  i.user_id,
  l.investor_id,
  l.project_id,
  'vorgemerkt',
  coalesce(l.created_at, now()),
  now()
from public.investor_project_links l
join public.investors i on i.id = l.investor_id
join public.projects p on p.id = l.project_id and p.user_id = i.user_id
on conflict (user_id, investor_id, project_id) do nothing;

comment on table public.investor_project_assignments is
  'Zentrale Quelle für Investor-Projekt-Zuordnungen inklusive Versand- und Interessestatus.';
