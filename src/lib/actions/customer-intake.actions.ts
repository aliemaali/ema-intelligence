'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { ProjectCustomerIntake, ProjectFieldSource } from '@/lib/projects/master-data'

function text(formData: FormData, key: string): string | undefined {
  const value = formData.get(key)
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

function numberValue(formData: FormData, key: string): number | undefined {
  const raw = text(formData, key)?.replace(',', '.')
  if (!raw) return undefined
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : undefined
}

export async function saveProjectCustomerIntake(projectId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: project, error: readError } = await supabase
    .from('projects')
    .select('id, source_metadata')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()

  if (readError || !project) {
    return { error: readError?.message ?? 'Projekt wurde nicht gefunden.' }
  }

  const intake: ProjectCustomerIntake = {
    companyName: text(formData, 'companyName'),
    contactPerson: text(formData, 'contactPerson'),
    phone: text(formData, 'phone'),
    email: text(formData, 'email'),
    customerType: text(formData, 'customerType'),
    buildingType: text(formData, 'buildingType'),
    usageType: text(formData, 'usageType'),
    postalCode: text(formData, 'postalCode'),
    parcel: text(formData, 'parcel'),
    gridOperator: text(formData, 'gridOperator'),
    roofAreaSqm: numberValue(formData, 'roofAreaSqm'),
    annualConsumptionKwh: numberValue(formData, 'annualConsumptionKwh'),
    notes: text(formData, 'notes'),
  }

  const savedAt = new Date().toISOString()
  const source: ProjectFieldSource = {
    source: 'customer_intake',
    sourceName: 'EMA Kundenaufnahme',
    importedAt: savedAt,
  }

  const previousSources =
    project.source_metadata && typeof project.source_metadata === 'object'
      ? (project.source_metadata as Record<string, ProjectFieldSource>)
      : {}

  const sourceMetadata = {
    ...previousSources,
    customerIntake: source,
  }

  const { error } = await supabase
    .from('projects')
    .update({
      customer_intake: intake,
      source_metadata: sourceMetadata,
      contact_name: intake.contactPerson ?? null,
      contact_email: intake.email ?? null,
      contact_phone: intake.phone ?? null,
      last_activity_at: savedAt,
    } as never)
    .eq('id', projectId)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  await supabase.from('activity_log').insert({
    user_id: user.id,
    project_id: projectId,
    activity_type: 'manual' as never,
    title: 'Kundenaufnahme aktualisiert',
    description: 'Die Kundenaufnahme wurde in den zentralen Projektdaten gespeichert.',
    metadata: { source: 'customer_intake' },
  })

  revalidatePath(`/projects/${projectId}/overview`)
  revalidatePath(`/projects/${projectId}`)
  revalidatePath('/projects')
  revalidatePath('/dashboard')
  return { success: true }
}
