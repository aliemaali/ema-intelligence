export type PlaudRemoteRecording = {
  id: string
  name: string
  created_at: string
  start_at?: string | null
  duration?: number | null
  serial_number?: string | null
}

export type PlaudContentBlock = {
  type?: string | null
  data_content?: unknown
  data_link?: string | null
  [key: string]: unknown
}

export type PlaudRemoteRecordingDetails = PlaudRemoteRecording & {
  source_list?: PlaudContentBlock[] | null
  note_list?: PlaudContentBlock[] | null
  presigned_url?: string | null
}

export type PlaudSuggestion = {
  type: 'task' | 'appointment'
  title: string
  detail: string
  due_at: string | null
}

export type PlaudPreparedMeeting = {
  sourceLanguage: string
  titleDe: string
  summaryDe: string
  transcriptDe: string
  suggestions: PlaudSuggestion[]
}
