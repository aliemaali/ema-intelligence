-- Keep PLAUD access limited to the operations used by the application.
-- TRUNCATE bypasses row-level policies, so it must not be available to
-- authenticated application users.
revoke all privileges on table public.plaud_items from authenticated;
revoke all privileges on table public.plaud_notes from authenticated;

grant select, insert, update, delete on table public.plaud_items to authenticated;
grant select, insert, update, delete on table public.plaud_notes to authenticated;
