import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const schema = z.object({
  country: z.string().trim().min(2).max(100),
  countryCode: z.string().trim().min(2).max(4).optional(),
  displayName: z.string().trim().min(1).max(160),
  plantType: z.enum(['Agri-PV', 'Freiflächen-PV', 'Carport', 'Dachanlage', 'Sonstiges']),
  projectCount: z.coerce.number().int().min(1).max(5000),
})

function safePart(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100) || 'Projektliste'
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file')
  const parsed = schema.safeParse({
    country: formData.get('country'),
    countryCode: formData.get('countryCode') || undefined,
    displayName: formData.get('displayName'),
    plantType: formData.get('plantType'),
    projectCount: formData.get('projectCount'),
  })

  if (!parsed.success || !(file instanceof File) || file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'Speicherdaten oder PDF sind ungültig.' }, { status: 400 })
  }

  const fileName = `${safePart(parsed.data.displayName)}.pdf`
  // Existing project-documents RLS requires the authenticated user id as the first path segment.
  const filePath = `${user.id}/country-project-lists/${safePart(parsed.data.country)}/${Date.now()}-${fileName}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await supabase.storage
    .from('project-documents')
    .upload(filePath, buffer, { contentType: 'application/pdf', upsert: false })

  if (uploadError) {
    console.error('Projektliste: Storage-Upload fehlgeschlagen', uploadError)
    return NextResponse.json({ error: `PDF konnte nicht gespeichert werden: ${uploadError.message}` }, { status: 500 })
  }

  const { data, error } = await supabase
    .from('country_project_lists')
    .insert({
      user_id: user.id,
      country: parsed.data.country,
      country_code: parsed.data.countryCode ?? null,
      display_name: parsed.data.displayName,
      file_name: fileName,
      file_path: filePath,
      file_size_bytes: buffer.byteLength,
      mime_type: 'application/pdf',
      plant_type: parsed.data.plantType,
      project_count: parsed.data.projectCount,
    } as never)
    .select('id')
    .single()

  if (error) {
    console.error('Projektliste: Datenbankeintrag fehlgeschlagen', error)
    await supabase.storage.from('project-documents').remove([filePath])
    return NextResponse.json({ error: `Projektliste konnte nicht registriert werden: ${error.message}` }, { status: 500 })
  }

  return NextResponse.json({ success: true, id: data.id })
}
