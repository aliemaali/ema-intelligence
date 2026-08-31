-- Keep privileged helper functions callable only by the roles that need them.
-- Trigger functions do not need direct API execution privileges.

-- Project numbering is reached only through the insert trigger. Making the
-- trigger a non-callable SECURITY DEFINER helper lets us close the direct RPC.
alter function public.trigger_set_project_number() security definer;
revoke all on function public.generate_project_number(public.project_type) from public, anon, authenticated;
grant execute on function public.generate_project_number(public.project_type) to service_role;

revoke all on function public.is_admin_or_owner() from public, anon;
grant execute on function public.is_admin_or_owner() to authenticated, service_role;

revoke all on function public.prevent_unauthorized_profile_privilege_changes() from public, anon, authenticated;
revoke all on function public.trigger_create_profile_on_signup() from public, anon, authenticated;

revoke all on function public.trigger_set_project_number() from public, anon, authenticated;
revoke all on function public.trigger_set_updated_at() from public, anon, authenticated;
revoke all on function public.trigger_update_project_last_activity() from public, anon, authenticated;
revoke all on function public.trigger_log_project_status_change() from public, anon, authenticated;
revoke all on function public.trigger_log_document_upload() from public, anon, authenticated;
revoke all on function public.trigger_log_investor_linked() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.normalize_acquisition_project_type() from public, anon, authenticated;
revoke all on function public.normalize_initial_email_salutation() from public, anon, authenticated;

alter function public.trigger_set_project_number() set search_path = public, pg_temp;
alter function public.trigger_set_updated_at() set search_path = public, pg_temp;
alter function public.trigger_update_project_last_activity() set search_path = public, pg_temp;
alter function public.trigger_log_project_status_change() set search_path = public, pg_temp;
alter function public.trigger_log_document_upload() set search_path = public, pg_temp;
alter function public.trigger_log_investor_linked() set search_path = public, pg_temp;
alter function public.set_updated_at() set search_path = public, pg_temp;
alter function public.normalize_acquisition_project_type() set search_path = public, pg_temp;
alter function public.normalize_initial_email_salutation() set search_path = public, pg_temp;
