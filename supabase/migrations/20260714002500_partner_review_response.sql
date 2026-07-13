-- EMA 4.0 – Partner response to EMA review questions

alter table public.project_submissions
  add column if not exists partner_response text,
  add column if not exists partner_responded_at timestamptz;

-- Restrict direct Data API updates to workflow fields only.
revoke update on public.project_submissions from authenticated;
grant update (
  status,
  review_note,
  reviewed_at,
  reviewed_by,
  partner_response,
  partner_responded_at
) on public.project_submissions to authenticated;

create policy "partner_submissions_update_review_response"
  on public.project_submissions for update
  to authenticated
  using (
    (select auth.uid()) = partner_user_id
    and status = 'rueckfrage'
  )
  with check (
    (select auth.uid()) = partner_user_id
    and status = 'eingereicht'
  );
