'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function text(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function numberValue(formData: FormData, key: string) {
  const value = text(formData, key)
  if (!value) return null
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeWebsite(value: string | null) {
  if (!value) return null
  return value.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '').toLowerCase()
}

function calculateScore(input: {
  acquisitionType: string
  email: string | null
  website: string | null
  contactName: string | null
  city: string | null
  potentialKwp: number | null
  roofArea: number | null
  projectStage: string | null
}) {
  let score = 10
  if (input.email) score += 20
  if (input.website) score += 10
  if (input.contactName) score += 10
  if (input.city) score += 5
  if (input.projectStage) score += 10

  if (input.acquisitionType === 'roof') {
    if ((input.roofArea || 0) >= 5000) score += 25
    else if ((input.roofArea || 0) >= 2000) score += 18
    else if ((input.roofArea || 0) >= 1000) score += 10

    if ((input.potentialKwp || 0) >= 1000) score += 20
    else if ((input.potentialKwp || 0) >= 500) score += 12
  } else {
    if ((input.potentialKwp || 0) >= 5000) score += 25
    else if ((input.potentialKwp || 0) >= 1000) score += 18
    else if ((input.potentialKwp || 0) >= 500) score += 10
  }

  return Math.min(score, 100)
}

async function findDuplicate(db: any, userId: string, input: { companyName: string; email: string | null; website: string | null }) {
  const { data: companyDuplicate } = await db
    .from('acquisition_leads')
    .select('id')
    .eq('user_id', userId)
    .ilike('company_name', input.companyName)
    .limit(1)
    .maybeSingle()
  if (companyDuplicate) return 'Firmenname bereits als Lead vorhanden'

  if (input.email) {
    const { data: emailDuplicate } = await db
      .from('acquisition_leads')
      .select('id')
      .eq('user_id', userId)
      .eq('email', input.email)
      .limit(1)
      .maybeSingle()
    if (emailDuplicate) return 'E-Mail-Adresse bereits als Lead vorhanden'
  }

  const normalizedWebsite = normalizeWebsite(input.website)
  if (normalizedWebsite) {
    const { data: candidates } = await db
      .from('acquisition_leads')
      .select('website')
      .eq('user_id', userId)
      .not('website', 'is', null)
      .limit(500)
    if ((candidates || []).some((item: { website: string | null }) => normalizeWebsite(item.website) === normalizedWebsite)) {
      return 'Website bereits als Lead vorhanden'
    }
  }

  return null
}

type ApprovedLead = {
  id: string
  acquisition_type: 'project' | 'roof'
  company_name: string
  contact_name: string | null
  email: string | null
  city: string | null
  estimated_potential_kwp: number | null
  estimated_roof_area_sqm: number | null
}

function buildInitialEmail(lead: ApprovedLead) {
  const salutation = lead.contact_name ? `Guten Tag ${lead.contact_name},` : 'Guten Tag,'
  const location = lead.city ? ` am Standort ${lead.city}` : ''
  const roofArea = lead.estimated_roof_area_sqm
    ? ` mit einer grob geschätzten Dachfläche von rund ${Math.round(lead.estimated_roof_area_sqm).toLocaleString('de-DE')} m²`
    : ''
  const potential = lead.estimated_potential_kwp
    ? ` und einem möglichen PV-Potenzial von etwa ${Math.round(lead.estimated_potential_kwp).toLocaleString('de-DE')} kWp`
    : ''

  if (lead.acquisition_type === 'roof') {
    return {
      subject: `Unverbindliche Anfrage zur Nutzung Ihrer Dachfläche${lead.city ? ` in ${lead.city}` : ''}`,
      body: `${salutation}\n\nwir sind auf die gewerblich genutzte Immobilie von ${lead.company_name}${location} aufmerksam geworden${roofArea}${potential}.\n\nEMA Enterprise GmbH entwickelt und vermittelt Photovoltaikprojekte für professionelle Investoren. In diesem Zusammenhang prüfen wir geeignete große Gewerbe- und Industriedächer für eine langfristige Nutzung oder Verpachtung.\n\nFür Sie kann daraus eine zusätzliche, langfristige Einnahme entstehen, ohne dass Sie selbst in die Photovoltaikanlage investieren müssen. Planung, Finanzierung, Bau und Betrieb werden durch geeignete Projektpartner übernommen.\n\nGerne würden wir unverbindlich prüfen, ob die Dachfläche grundsätzlich für ein solches Modell infrage kommt. Ein kurzer Austausch oder die Weiterleitung an die zuständige Person wäre dafür bereits hilfreich.\n\nMit freundlichen Grüßen\n\nAli Ünlüer\nEMA Enterprise GmbH\nConnecting Capital with Energy Infrastructure.\nE-Mail: unluer@ema-enterprise.de`,
    }
  }

  return {
    subject: `Anfrage zu möglichen Energieprojekten von ${lead.company_name}`,
    body: `${salutation}\n\nEMA Enterprise GmbH verbindet professionelle Investoren mit Photovoltaik-, BESS- und Hybridprojekten.\n\nWir sind auf ${lead.company_name}${location} aufmerksam geworden und möchten unverbindlich anfragen, ob Sie aktuell Projekte entwickeln, vermarkten oder geeignete Investitionsmöglichkeiten anbieten.\n\nFür eine erste Prüfung benötigen wir lediglich die wichtigsten Eckdaten wie Standort, Projektart, Leistung, Entwicklungsstand, Netzstatus und Preisvorstellung. Vertrauliche Unterlagen können anschließend kontrolliert ausgetauscht werden.\n\nIch freue mich über eine kurze Rückmeldung oder die Weiterleitung an die zuständige Person.\n\nMit freundlichen Grüßen\n\nAli Ünlüer\nEMA Enterprise GmbH\nConnecting Capital with Energy Infrastructure.\nE-Mail: unluer@ema-enterprise.de`,
  }
}

async function createDraftForApprovedLead(db: any, userId: string, lead: ApprovedLead) {
  if (!lead.email) return false

  const { data: existing } = await db
    .from('acquisition_emails')
    .select('id')
    .eq('user_id', userId)
    .eq('lead_id', lead.id)
    .eq('email_type', 'initial')
    .in('status', ['draft', 'ready_for_approval', 'approved', 'sending', 'sent'])
    .limit(1)
    .maybeSingle()

  if (existing) return false

  const draft = buildInitialEmail(lead)
  const { error } = await db.from('acquisition_emails').insert({
    user_id: userId,
    lead_id: lead.id,
    email_type: 'initial',
    recipient_email: lead.email,
    subject: draft.subject,
    body: draft.body,
    status: 'ready_for_approval',
  })

  if (error) return false

  await db.from('acquisition_leads').update({
    status: 'ready_for_approval',
    next_action: 'E-Mail-Entwurf prüfen und freigeben',
  }).eq('id', lead.id).eq('user_id', userId)

  await db.from('acquisition_activities').insert({
    user_id: userId,
    lead_id: lead.id,
    activity_type: 'email_created',
    title: 'Passender Erstkontakt-Entwurf vorbereitet',
    description: 'EMA Scout hat nach der Lead-Übernahme automatisch einen personalisierten Entwurf zur Freigabe erstellt.',
  })

  return true
}

async function approveCandidateById(db: any, userId: string, candidateId: string) {
  const { data: candidate } = await db
    .from('acquisition_research_candidates')
    .select('*')
    .eq('id', candidateId)
    .eq('user_id', userId)
    .eq('status', 'new')
    .single()

  if (!candidate) return { approved: false, drafted: false, duplicate: false }

  const duplicateReason = await findDuplicate(db, userId, {
    companyName: candidate.company_name,
    email: candidate.email,
    website: candidate.website,
  })

  if (duplicateReason) {
    await db.from('acquisition_research_candidates').update({
      status: 'duplicate', duplicate_reason: duplicateReason, reviewed_at: new Date().toISOString(),
    }).eq('id', candidate.id).eq('user_id', userId)
    return { approved: false, drafted: false, duplicate: true }
  }

  const { data: lead, error } = await db.from('acquisition_leads').insert({
    user_id: userId,
    acquisition_type: candidate.acquisition_type,
    company_name: candidate.company_name,
    contact_name: candidate.contact_name,
    contact_role: candidate.contact_role,
    email: candidate.email,
    website: candidate.website,
    city: candidate.city,
    state: candidate.state,
    source_name: candidate.source_name,
    source_url: candidate.source_url,
    project_type: candidate.project_type,
    project_stage: candidate.project_stage,
    estimated_potential_kwp: candidate.estimated_potential_kwp,
    estimated_roof_area_sqm: candidate.estimated_roof_area_sqm,
    score: candidate.score,
    notes: candidate.source_snippet,
    status: 'researching',
    next_action: candidate.email ? 'E-Mail-Entwurf prüfen und freigeben' : 'Kontaktperson und E-Mail recherchieren',
  }).select('id,acquisition_type,company_name,contact_name,email,city,estimated_potential_kwp,estimated_roof_area_sqm').single()

  if (error || !lead) return { approved: false, drafted: false, duplicate: false }

  await db.from('acquisition_research_candidates').update({
    status: 'approved', reviewed_at: new Date().toISOString(), imported_lead_id: lead.id,
  }).eq('id', candidate.id).eq('user_id', userId)

  await db.from('acquisition_activities').insert({
    user_id: userId,
    lead_id: lead.id,
    activity_type: 'created',
    title: 'Recherche-Vorschlag als Lead übernommen',
    description: `Vorschlag aus ${candidate.source_name} wurde mit Score ${candidate.score} übernommen.`,
    metadata: { candidate_id: candidate.id, score: candidate.score, source_url: candidate.source_url },
  })

  const drafted = await createDraftForApprovedLead(db, userId, lead as ApprovedLead)
  return { approved: true, drafted, duplicate: false }
}

export async function queueResearchCandidate(formData: FormData) {
  const supabase = await createClient()
  const db = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const companyName = text(formData, 'company_name')
  const acquisitionType = text(formData, 'acquisition_type')
  if (!companyName || !['project', 'roof'].includes(acquisitionType || '')) {
    redirect('/acquisition/research?error=missing')
  }

  const email = text(formData, 'email')?.toLowerCase() || null
  const website = text(formData, 'website')
  const contactName = text(formData, 'contact_name')
  const city = text(formData, 'city')
  const potentialKwp = numberValue(formData, 'estimated_potential_kwp')
  const roofArea = numberValue(formData, 'estimated_roof_area_sqm')
  const projectStage = text(formData, 'project_stage')
  const sourceUrl = text(formData, 'source_url')

  const score = calculateScore({
    acquisitionType: acquisitionType!, email, website, contactName, city, potentialKwp, roofArea, projectStage,
  })

  const duplicateReason = await findDuplicate(db, user.id, { companyName, email, website })
  const { error } = await db.from('acquisition_research_candidates').insert({
    user_id: user.id,
    acquisition_type: acquisitionType,
    company_name: companyName,
    website,
    email,
    contact_name: contactName,
    contact_role: text(formData, 'contact_role'),
    city,
    state: text(formData, 'state'),
    source_name: text(formData, 'source_name') || 'EMA Scout Recherche',
    source_url: sourceUrl,
    source_snippet: text(formData, 'notes'),
    project_type: text(formData, 'project_type'),
    project_stage: projectStage,
    estimated_potential_kwp: potentialKwp,
    estimated_roof_area_sqm: roofArea,
    score,
    status: duplicateReason ? 'duplicate' : 'new',
    duplicate_reason: duplicateReason,
  })

  if (error) redirect('/acquisition/research?error=save')
  revalidatePath('/acquisition/research/inbox')
  redirect(`/acquisition/research/inbox?queued=1&score=${score}`)
}

export async function approveResearchCandidate(formData: FormData) {
  const candidateId = text(formData, 'candidate_id')
  if (!candidateId) redirect('/acquisition/research/inbox?error=candidate')

  const supabase = await createClient()
  const db = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const result = await approveCandidateById(db, user.id, candidateId)
  revalidatePath('/acquisition')
  revalidatePath('/acquisition/approvals')
  revalidatePath('/acquisition/research/inbox')

  if (result.duplicate) redirect('/acquisition/research/inbox?error=duplicate')
  if (!result.approved) redirect('/acquisition/research/inbox?error=save')
  redirect(`/acquisition/research/inbox?approved=1&drafted=${result.drafted ? '1' : '0'}`)
}

export async function bulkApproveResearchCandidates(formData: FormData) {
  const ids = formData.getAll('candidate_id').filter((value): value is string => typeof value === 'string' && Boolean(value))
  if (!ids.length) redirect('/acquisition/research/inbox?error=selection')

  const supabase = await createClient()
  const db = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let approved = 0
  let drafted = 0
  let duplicates = 0
  for (const id of ids.slice(0, 100)) {
    const result = await approveCandidateById(db, user.id, id)
    if (result.approved) approved += 1
    if (result.drafted) drafted += 1
    if (result.duplicate) duplicates += 1
  }

  revalidatePath('/acquisition')
  revalidatePath('/acquisition/approvals')
  revalidatePath('/acquisition/research/inbox')
  redirect(`/acquisition/research/inbox?bulkApproved=${approved}&bulkDrafted=${drafted}&duplicates=${duplicates}`)
}

export async function rejectResearchCandidate(formData: FormData) {
  const candidateId = text(formData, 'candidate_id')
  if (!candidateId) redirect('/acquisition/research/inbox')

  const supabase = await createClient()
  const db = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await db.from('acquisition_research_candidates').update({
    status: 'rejected', reviewed_at: new Date().toISOString(),
  }).eq('id', candidateId).eq('user_id', user.id).eq('status', 'new')

  revalidatePath('/acquisition/research/inbox')
}

export async function bulkRejectResearchCandidates(formData: FormData) {
  const ids = formData.getAll('candidate_id').filter((value): value is string => typeof value === 'string' && Boolean(value))
  if (!ids.length) redirect('/acquisition/research/inbox?error=selection')

  const supabase = await createClient()
  const db = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await db.from('acquisition_research_candidates').update({
    status: 'rejected', reviewed_at: new Date().toISOString(),
  }).eq('user_id', user.id).eq('status', 'new').in('id', ids.slice(0, 100)).select('id')

  revalidatePath('/acquisition/research/inbox')
  redirect(`/acquisition/research/inbox?bulkRejected=${data?.length || 0}`)
}
