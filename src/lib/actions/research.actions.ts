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

export async function importResearchedLead(formData: FormData) {
  const supabase = await createClient()
  const db = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const companyName = text(formData, 'company_name')
  const acquisitionType = text(formData, 'acquisition_type')
  const email = text(formData, 'email')?.toLowerCase() || null
  const website = text(formData, 'website')
  const normalizedWebsite = normalizeWebsite(website)

  if (!companyName || !['project', 'roof'].includes(acquisitionType || '')) {
    redirect('/acquisition/research?error=missing')
  }

  let duplicateQuery = db
    .from('acquisition_leads')
    .select('id,company_name,email,website')
    .eq('user_id', user.id)
    .ilike('company_name', companyName)
    .limit(1)

  const { data: companyDuplicate } = await duplicateQuery.maybeSingle()
  if (companyDuplicate) redirect('/acquisition/research?error=duplicate')

  if (email) {
    const { data: emailDuplicate } = await db
      .from('acquisition_leads')
      .select('id')
      .eq('user_id', user.id)
      .eq('email', email)
      .limit(1)
      .maybeSingle()
    if (emailDuplicate) redirect('/acquisition/research?error=duplicate')
  }

  if (normalizedWebsite) {
    const { data: websiteCandidates } = await db
      .from('acquisition_leads')
      .select('id,website')
      .eq('user_id', user.id)
      .not('website', 'is', null)
      .limit(250)

    const websiteDuplicate = (websiteCandidates || []).some((lead: { website: string | null }) => normalizeWebsite(lead.website) === normalizedWebsite)
    if (websiteDuplicate) redirect('/acquisition/research?error=duplicate')
  }

  const potentialKwp = numberValue(formData, 'estimated_potential_kwp')
  const roofArea = numberValue(formData, 'estimated_roof_area_sqm')
  const contactName = text(formData, 'contact_name')
  const city = text(formData, 'city')
  const projectStage = text(formData, 'project_stage')

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

  const sourceName = text(formData, 'source_name') || 'EMA Scout Recherche'
  const { data: lead, error } = await db
    .from('acquisition_leads')
    .insert({
      user_id: user.id,
      acquisition_type: acquisitionType,
      company_name: companyName,
      contact_name: contactName,
      contact_role: text(formData, 'contact_role'),
      email,
      phone: text(formData, 'phone'),
      website,
      street: text(formData, 'street'),
      postal_code: text(formData, 'postal_code'),
      city,
      state: text(formData, 'state'),
      source_name: sourceName,
      source_url: text(formData, 'source_url'),
      project_type: text(formData, 'project_type'),
      project_stage: projectStage,
      estimated_potential_kwp: potentialKwp,
      estimated_roof_area_sqm: roofArea,
      score,
      notes: text(formData, 'notes'),
      status: 'researching',
      next_action: email ? 'Recherche prüfen und E-Mail-Entwurf vorbereiten' : 'Kontaktperson und E-Mail recherchieren',
    })
    .select('id')
    .single()

  if (error || !lead) redirect('/acquisition/research?error=save')

  await db.from('acquisition_activities').insert({
    user_id: user.id,
    lead_id: lead.id,
    activity_type: 'created',
    title: 'Recherche-Lead übernommen',
    description: `Lead wurde aus ${sourceName} übernommen und mit Score ${score} bewertet.`,
    metadata: { score, source_name: sourceName, duplicate_check: true },
  })

  revalidatePath('/acquisition')
  revalidatePath('/acquisition/research')
  redirect(`/acquisition/research?created=1&score=${score}`)
}
