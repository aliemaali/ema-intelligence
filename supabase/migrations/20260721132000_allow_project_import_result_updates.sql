-- Allow authenticated users to refresh only their own project import analysis results.
-- This fixes repeated analysis attempts returning no row to PostgREST `.single()`.

drop policy if exists results_update on public.project_import_results;

create policy results_update
on public.project_import_results
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
