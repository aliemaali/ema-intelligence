export type EmaSourceApp = 'office' | 'intelligence'

export type EmaReminderStatus = 'scheduled' | 'sent' | 'cancelled'

export interface EmaReminderRecipient {
  userId: string
  displayName: string
}

export interface CreateEmaReminderInput {
  title: string
  body?: string
  remindAt: string
  sourceApp: EmaSourceApp
  recipientUserIds: string[]
  relatedType?: string
  relatedId?: string
}

export interface EmaReminder {
  id: string
  title: string
  body: string | null
  remindAt: string
  sourceApp: EmaSourceApp
  createdBy: string | null
  status: EmaReminderStatus
}
