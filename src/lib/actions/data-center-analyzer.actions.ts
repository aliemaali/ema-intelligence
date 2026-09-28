'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const GRID_STATUSES = new Set([
  'unknown',
  'indicated',
  'requested',
  'grid_study_ongoing',
  'generally_feasible',
  'confirmed_in_writing',
  'contractually_secured',
])

const OFFTAKER_STATUSES = new Set([
  'unknown',
  'none',
  'searching',
  'initial_contact',
  'nda',
  'interest',
  'loi',
  'hot',
  'binding_contract',
])

const PROJECT_MODELS = new Set([
  'unknown',
  'greenfield',
  'existing_building',
  'brownfield_conversion',
  'shell',
  'powered_shell',
  'turnkey',
])

function text(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function nullableNumber(formData: FormData, key: string) {
  const value = text(formData, key).replace(',', '.')
  if (!value) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function allowed(value: string, values: Set<string>, fallback: string) {
  return values.has(value) ? value : fallback
}

function riskValue(formData: FormData, key: string) {
  const value = text(formData, key)
  return ['green', 'orange', 'red', 'grey'].includes(value) ? value : 'grey'
}

export async function createDataCenterAnalyzerProject(formData: FormData) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  const address = text(formData, 'address')
  const city = text(formData, 'city')
  const fromSmartCheck = text(formData, 'smartCheckSource') === 'partner_note'
  if (!address && !city && !fromSmartCheck) return { error: 'Bitte einen Standort auswählen oder eingeben.' }
  const projectName = text(formData, 'projectName') || `Rechenzentrum ${city || address}`

  const gridCapacityMw = nullableNumber(formData, 'gridCapacityMw')
  const pue = nullableNumber(formData, 'pue') ?? 1.25
  const estimatedItMw = gridCapacityMw && pue > 0 ? gridCapacityMw / pue : null
  const gridStatus = allowed(text(formData, 'gridStatus'), GRID_STATUSES, fromSmartCheck ? 'unknown' : 'indicated')
  const offtakerStatus = allowed(text(formData, 'offtakerStatus'), OFFTAKER_STATUSES, fromSmartCheck ? 'unknown' : 'none')
  const projectModel = allowed(text(formData, 'projectModel'), PROJECT_MODELS, fromSmartCheck ? 'unknown' : 'greenfield')
  const purchasePriceMode = text(formData, 'purchasePriceMode') === 'per_mw' ? 'per_mw' : 'total'
  const totalPurchasePrice = nullableNumber(formData, 'totalPurchasePrice')
  const pricePerMw = nullableNumber(formData, 'pricePerMw')
  const referenceCapacity = ['grid', 'it'].includes(text(formData, 'referenceCapacity'))
    ? text(formData, 'referenceCapacity')
    : ''
  const calculatedPurchasePrice = purchasePriceMode === 'total'
    ? totalPurchasePrice
    : pricePerMw && referenceCapacity
      ? pricePerMw * (referenceCapacity === 'grid' ? (gridCapacityMw ?? 0) : (estimatedItMw ?? 0))
      : null
  const savedAt = new Date().toISOString()

  const risks = {
    flood: riskValue(formData, 'riskFlood'),
    heavyRain: riskValue(formData, 'riskHeavyRain'),
    waterProtection: riskValue(formData, 'riskWaterProtection'),
    natureProtection: riskValue(formData, 'riskNatureProtection'),
    residentialNoise: riskValue(formData, 'riskResidentialNoise'),
    contamination: riskValue(formData, 'riskContamination'),
    access: riskValue(formData, 'riskAccess'),
    airport: riskValue(formData, 'riskAirport'),
    expansion: riskValue(formData, 'riskExpansion'),
  }

  const critical: string[] = []
  const toVerify: string[] = []
  if (!gridCapacityMw) critical.push('Netzanschlussleistung fehlt')
  else if (!['confirmed_in_writing', 'contractually_secured'].includes(gridStatus)) critical.push('Netzanschlussleistung nicht bestätigt')
  else toVerify.push('Netznachweis dokumentarisch prüfen')
  if (!address && !city) toVerify.push('Projektstandort erfragen')
  if (text(formData, 'planningStatus') === 'planning_conflict') critical.push('Baurechtlicher Konflikt angegeben')
  if (text(formData, 'dataCenterUseStatus') !== 'confirmed') toVerify.push('Data-Center-Nutzung baurechtlich bestätigen')
  if (text(formData, 'routeDiversityStatus') !== 'confirmed') toVerify.push('Physische Glasfaserredundanz bestätigen')
  if (offtakerStatus !== 'binding_contract') toVerify.push('Verbindlichen Offtake-Vertrag prüfen')
  for (const [key, value] of Object.entries(risks)) {
    if (value === 'red') critical.push(`Standortrisiko: ${key}`)
    if (value === 'orange') toVerify.push(`Standortrisiko prüfen: ${key}`)
  }

  const siteCheck = {
    analyzerVersion: 1,
    intakeMode: fromSmartCheck ? 'smart_check' : 'full_form',
    address,
    street: text(formData, 'street'),
    houseNumber: text(formData, 'houseNumber'),
    postalCode: text(formData, 'postalCode'),
    municipality: text(formData, 'municipality'),
    district: text(formData, 'district'),
    siteAreaHectares: nullableNumber(formData, 'siteAreaSqm') !== null
      ? Number(nullableNumber(formData, 'siteAreaSqm')) / 10_000
      : undefined,
    gridStatus,
    gridOperator: text(formData, 'gridOperator'),
    voltageLevel: text(formData, 'voltageLevel'),
    pointOfConnection: text(formData, 'pointOfConnection'),
    availableFrom: text(formData, 'availableFrom'),
    pue,
    planningStatus: text(formData, 'planningStatus'),
    dataCenterUseStatus: text(formData, 'dataCenterUseStatus'),
    connectivityStatus: text(formData, 'connectivityStatus'),
    carriers: text(formData, 'carriers').split(',').map((value) => value.trim()).filter(Boolean),
    routeDiversityStatus: text(formData, 'routeDiversityStatus'),
    risks,
    riskNotes: text(formData, 'riskNotes'),
    offtakerStatus,
    offtakerName: text(formData, 'offtakerName'),
    requestedCapacityMw: nullableNumber(formData, 'requestedCapacityMw'),
    contractTerm: text(formData, 'contractTerm'),
    plannedStart: text(formData, 'plannedStart'),
    projectModel,
    purchasePrice: {
      mode: purchasePriceMode,
      total: totalPurchasePrice,
      pricePerMw,
      referenceCapacity,
      calculatedTotal: calculatedPurchasePrice,
      basisStatus: referenceCapacity === 'it' ? 'ESTIMATED' : 'INDICATED',
    },
    assessment: {
      stage: critical.length ? 'CRITICAL' : gridCapacityMw && address ? 'DEVELOPMENT' : 'EARLY_STAGE',
      critical,
      toVerify,
      verified: [],
      generatedAt: savedAt,
    },
    additionalNotes: text(formData, 'notes'),
    savedAt,
  }

  const { data, error } = await supabase
    .from('projects')
    .insert({
      user_id: user.id,
      project_name: projectName,
      project_type: 'rechenzentrum',
      status: 'lead',
      project_stage: 'planung',
      priority: 'mittel',
      marketing_status: 'nicht_gestartet',
      location_address: address || null,
      location_city: city || null,
      location_state: text(formData, 'state') || null,
      location_country: text(formData, 'country') || 'Deutschland',
      location_lat: nullableNumber(formData, 'latitude'),
      location_lng: nullableNumber(formData, 'longitude'),
      data_center_grid_mw: gridCapacityMw,
      data_center_it_mw: estimatedItMw,
      data_center_grid_confirmed: false,
      data_center_status: 'in_entwicklung',
      data_center_site_check: siteCheck,
      land_area_sqm: nullableNumber(formData, 'siteAreaSqm'),
      transformer_status: [text(formData, 'voltageLevel'), text(formData, 'pointOfConnection')].filter(Boolean).join(' · ') || null,
      dev_status: {
        netzanschluss: null,
        baugenehmigung: null,
        pachtvertrag: null,
        eeg_faehigkeit: null,
        gutachten: null,
        umweltpruefung: null,
      },
      source_metadata: {
        dataCenterAnalyzer: {
          source: fromSmartCheck ? 'partner_note' : 'manual',
          sourceName: fromSmartCheck ? 'EMA Data Center Smart Check' : 'EMA Data Center Analyzer',
          importedAt: savedAt,
        },
      },
      notes: text(formData, 'notes') || null,
      tags: fromSmartCheck ? ['data-center-analyzer', 'smart-check'] : ['data-center-analyzer'],
      is_archived: false,
      last_activity_at: savedAt,
    } as never)
    .select('id')
    .single()

  if (error || !data) return { error: error?.message ?? 'Projekt konnte nicht gespeichert werden.' }

  await supabase.from('activity_log').insert({
    user_id: user.id,
    project_id: data.id,
    activity_type: 'manual' as never,
    title: 'Data-Center-Projekt erstellt',
    description: `${projectName} wurde im EMA Data Center Analyzer erfasst. Netzangaben bleiben bis zur Dokumentenprüfung unbestätigt.`,
    metadata: { source: 'data_center_analyzer', grid_status: gridStatus },
  })

  revalidatePath('/projects')
  revalidatePath('/dashboard')
  return { success: true, projectId: data.id }
}
