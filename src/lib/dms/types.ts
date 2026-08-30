export type DmsSourceApp = 'ema_intelligence' | 'ema_office' | 'external'
export type DmsSourceKind =
  | 'project'
  | 'contact'
  | 'template'
  | 'office'
  | 'data_room'
  | 'data_room_entry'
  | 'dd_report'
  | 'partner_submission'

export type DmsDocument = {
  id: string
  project_id: string | null
  user_id: string
  document_type: string
  display_name: string
  file_name: string
  file_path: string
  file_size_bytes: number | null
  mime_type: string | null
  storage_bucket: string
  source_app: DmsSourceApp
  source_kind: DmsSourceKind
  source_record_id: string | null
  sha256: string | null
  folder_id: string | null
  is_data_room_archive: boolean
  ai_analyzed: boolean
  analysis_status: 'not_started' | 'queued' | 'processing' | 'completed' | 'failed'
  is_archived: boolean
  created_at: string
}

export type DmsFolder = {
  id: string
  name: string
  parent_id: string | null
}

export type DmsDataRoom = {
  id: string
  project_id: string | null
  archive_document_id: string
  name: string
  project_profile: 'pv' | 'bess' | 'pv_bess' | 'wind' | 'datacenter' | 'other'
  status: 'uploaded' | 'extracting' | 'ready' | 'analyzing' | 'completed' | 'failed'
  file_count: number
  total_uncompressed_bytes: number
  error_message: string | null
  created_at: string
}

export type DmsProjectOption = {
  id: string
  label: string
  projectType: string
}
