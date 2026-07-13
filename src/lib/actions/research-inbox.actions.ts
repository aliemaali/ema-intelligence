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
    acquisitionType: acquisitionType!,
    email,
    website,
    contactName,
    city,
    potentialKwp,
    roofArea,
    projectStage,
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

  const { data: candidate } = await db
    .from('acquisition_research_candidates')
    .select('*')
    .eq('id', candidateId)
    .eq('user_id', user.id)
    .eq('status', 'new')
    .single()

  if (!candidate) redirect('/acquisition/research/inbox?error=candidate')

  const duplicateReason = await findDuplicate(db, user.id, {
    companyName: candidate.company_name,
    email: candidate.email,
    website: candidate.website,
  })

  if (duplicateReason) {
    await db.from('acquisition_research_candidates').update({
      status: 'duplicate', duplicate_reason: duplicateReason, reviewed_at: new Date().toISOString(),
    }).eq('id', candidate.id).eq('user_id', user.id)
    revalidatePath('/acquisition/research/inbox')
    redirect('/acquisition/research/inbox?error=duplicate')
  }

  const { data: lead, error } = await db.from('acquisition_leads').insert({
    user_id: user.id,
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
    next_action: candidate.email ? 'Recherche prüfen und E-Mail-Entwurf vorbereiten' : 'Kontaktperson und E-Mail recherchieren',
  }).select('id').single()

  if (error || !lead) redirect('/acquisition/research/inbox?error=save')

  await db.from('acquisition_research_candidates').update({
    status: 'approved', reviewed_at: new Date().toISOString(), imported_lead_id: lead.id,
  }).eq('id', candidate.id).eq('user_id', user.id)

  await db.from('acquisition_activities').insert({
    user_id: user.id,
    lead_id: lead.id,
    activity_type: 'created',
    title: 'Recherche-Vorschlag als Lead übernommen',
    description: `Vorschlag aus ${candidate.source_name} wurde mit Score ${candidate.score} übernommen.`,
    metadata: { candidate_id: candidate.id, score: candidate.score, source_url: candidate.source_url },
  })

  revalidatePath('/acquisition')
  revalidatePath('/acquisition/research/inbox')
  redirect('/acquisition/research/inbox?approved=1')
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
