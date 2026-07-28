drop policy if exists "Users can delete own document deliveries" on public.document_deliveries;
create policy "Users can delete own document deliveries"
  on public.document_deliveries for delete
  using (auth.uid() = user_id);
