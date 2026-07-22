-- Explicit deny policy keeps encrypted Microsoft tokens inaccessible to browser roles
-- while the service role continues to bypass RLS server-side.

create policy "No direct Microsoft connection access"
on public.microsoft_connections
for all
to anon, authenticated
using (false)
with check (false);
