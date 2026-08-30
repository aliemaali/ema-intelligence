create index if not exists dms_data_room_documents_user_idx
  on public.dms_data_room_documents(user_id);

create index if not exists dms_data_rooms_archive_document_idx
  on public.dms_data_rooms(archive_document_id);

create index if not exists dms_due_diligence_reports_project_idx
  on public.dms_due_diligence_reports(project_id)
  where project_id is not null;

create index if not exists dms_due_diligence_reports_report_document_idx
  on public.dms_due_diligence_reports(report_document_id)
  where report_document_id is not null;

create index if not exists documents_parent_id_idx
  on public.documents(parent_id)
  where parent_id is not null;
