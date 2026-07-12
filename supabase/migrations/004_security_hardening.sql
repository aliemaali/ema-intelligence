-- ============================================================
-- EMA Intelligence – Security hardening
-- Ensures exposed views execute with the querying user's rights
-- and are unavailable to anonymous callers.
-- ============================================================

-- PostgreSQL views are security definer by default. Enabling
-- security_invoker makes the underlying table RLS policies apply
-- to the authenticated caller.
ALTER VIEW public.v_dashboard_kpis
  SET (security_invoker = true);

ALTER VIEW public.v_projects_with_deals
  SET (security_invoker = true);

-- The application only needs these views for signed-in users.
REVOKE ALL ON TABLE public.v_dashboard_kpis FROM anon;
REVOKE ALL ON TABLE public.v_projects_with_deals FROM anon;

GRANT SELECT ON TABLE public.v_dashboard_kpis TO authenticated;
GRANT SELECT ON TABLE public.v_projects_with_deals TO authenticated;
