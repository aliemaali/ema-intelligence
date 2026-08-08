'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { DataCenterSiteCheck, ProjectFieldSource } from '@/lib/projects/master-data'

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
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
}

export async function saveDataCenterSiteCheck(projectId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: project, error: readError } = await supabase
    .from('projects')
    .select('id, project_type, source_metadata')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()

  if (readError || !project) return { error: readError?.message ?? 'Projekt wurde nicht gefunden.' }
  if (project.project_type !== 'rechenzentrum') return { error: 'Die Standortprüfung ist nur für Rechenzentrum-Projekte verfügbar.' }

  const savedAt = new Date().toISOString()
  const siteAreaHectares = numberValue(formData, 'siteAreaHectares')
  const gridMw = numberValue(formData, 'gridMw')
  const gridConfirmed = formData.get('gridConfirmed') === 'on' && Boolean(gridMw)

  const check: DataCenterSiteCheck = {
    district: text(formData, 'district'),
    streetPlot: text(formData, 'streetPlot'),
    gpsCoordinates: text(formData, 'gpsCoordinates'),
    siteAreaHectares,
    landCost: text(formData, 'landCost'),
    pricePerSqmEur: numberValue(formData, 'pricePerSqmEur'),
    zoningDesignation: text(formData, 'zoningDesignation') as DataCenterSiteCheck['zoningDesignation'],
    otherDesignation: text(formData, 'otherDesignation'),
    zoningPlanStatus: text(formData, 'zoningPlanStatus') as DataCenterSiteCheck['zoningPlanStatus'],
    dataCenterPermitted: text(formData, 'dataCenterPermitted') as DataCenterSiteCheck['dataCenterPermitted'],
    planningNotes: text(formData, 'planningNotes'),
    hvDistanceMeters: numberValue(formData, 'hvDistanceMeters'),
    hvStationName: text(formData, 'hvStationName'),
    gridOperator: text(formData, 'gridOperator'),
    fiberDistanceMeters: numberValue(formData, 'fiberDistanceMeters'),
    fiberProvider: text(formData, 'fiberProvider'),
    fiberStatus: text(formData, 'fiberStatus') as DataCenterSiteCheck['fiberStatus'],
    assessmentDate: text(formData, 'assessmentDate'),
    additionalNotes: text(formData, 'additionalNotes'),
    savedAt,
  }

  const source: ProjectFieldSource = {
    source: 'data_center_site_check',
    sourceName: 'EMA Standortprüfung Rechenzentrum',
    importedAt: savedAt,
    verifiedAt: gridConfirmed ? savedAt : undefined,
  }
  const previousSources = project.source_metadata && typeof project.source_metadata === 'object'
    ? project.source_metadata as Record<string, ProjectFieldSource>
    : {}

  const { error } = await supabase
    .from('projects')
    .update({
      data_center_site_check: check,
      data_center_grid_mw: gridMw ?? null,
      data_center_grid_confirmed: gridConfirmed,
      land_area_sqm: siteAreaHectares !== undefined ? siteAreaHectares * 10_000 : null,
      location_state: text(formData, 'state') ?? null,
      location_city: text(formData, 'city') ?? null,
      location_address: check.streetPlot ?? null,
      contact_name: text(formData, 'contactName') ?? null,
      contact_phone: text(formData, 'contactPhone') ?? null,
      contact_email: text(formData, 'contactEmail') ?? null,
      source_metadata: { ...previousSources, dataCenterSiteCheck: source },
      last_activity_at: savedAt,
    } as never)
    .eq('id', projectId)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  await supabase.from('activity_log').insert({
    user_id: user.id,
    project_id: projectId,
    activity_type: 'manual' as never,
    title: 'Standortprüfung aktualisiert',
    description: gridConfirmed
      ? 'Rechenzentrum-Standortdaten gespeichert; Netzleistung als bestätigt markiert.'
      : 'Rechenzentrum-Standortdaten gespeichert; Netzleistung bleibt unbestätigt.',
    metadata: { source: 'data_center_site_check', grid_confirmed: gridConfirmed },
  })

  revalidatePath(`/projects/${projectId}/site-check`)
  revalidatePath(`/projects/${projectId}/overview`)
  revalidatePath(`/projects/${projectId}`)
  revalidatePath('/projects')
  revalidatePath('/dashboard')
  return { success: true }
}
