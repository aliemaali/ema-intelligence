import { recognizeProjectImage } from '@/lib/import/recognizeImage'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { extractExposeText } from '@/lib/expose/import'

export const runtime = 'nodejs'
export const maxDuration = 60
const MAX_BYTES = 4 * 1024 * 1024

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Bitte erneut anmelden.' }, { status: 401 })
  if (Number(request.headers.get('content-length')) > MAX_BYTES + 16000) return NextResponse.json({ error: 'Maximal 4 MB pro Datei.' }, { status: 413 })
  try {
    const form = await request.formData()
    const projectId = form.get('projectId')
    if (!z.string().uuid().safeParse(projectId).success) return NextResponse.json({ error: 'Bitte zuerst ein Projekt auswählen.' }, { status: 400 })
    const { data: project } = await supabase.from('projects').select('id').eq('id', String(projectId)).eq('user_id', user.id).eq('is_archived', false).single()
    if (!project) return NextResponse.json({ error: 'Projekt nicht gefunden.' }, { status: 404 })
    const file = form.get('file')
    if (!(file instanceof File) || !file.size || file.size > MAX_BYTES) return NextResponse.json({ error: 'Bitte eine Datei mit maximal 4 MB auswählen.' }, { status: 400 })
    const bytes = Buffer.from(await file.arrayBuffer())
    let text = ''
    if (/\.pdf$/i.test(file.name) && bytes.subarray(0, 5).toString() === '%PDF-') {
      // Import the library entry directly: pdf-parse's root entry runs a debug fixture in some bundlers.
      const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default
      const pdf = await pdfParse(bytes, { max: 10 })
      if ((pdf.numpages ?? 0) > 10) throw new Error('Diese PDF hat mehr als 10 Seiten. Bitte die relevanten Projektseiten separat hochladen.')
      text = pdf.text
      if (text.trim().length < 20) throw new Error('Diese PDF enthält keinen lesbaren Text. Bitte die relevanten Seiten als JPG oder PNG hochladen.')
    } else if (/\.(jpe?g|png|webp)$/i.test(file.name) && (bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255])) || bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) || (bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP'))) {
      text = await recognizeProjectImage(bytes)
    } else if (/\.(txt|csv)$/i.test(file.name) && !bytes.includes(0)) {
      text = bytes.toString('utf8')
    } else {
      throw new Error('Unterstützt werden JPG, PNG, WebP, Text-PDF, TXT und CSV. Andere Dateien bitte als PDF exportieren.')
    }
    return NextResponse.json({ imported: extractExposeText(text, file.name.slice(0, 255)) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const known = error instanceof Error && /^(Kein |Zu viel |Einige |Text erkannt|Diese PDF|Unterstützt)/.test(error.message)
    return NextResponse.json({ error: known ? error.message : 'Datei konnte nicht gelesen werden. Bitte ein schärferes Bild oder eine Text-PDF verwenden.' }, { status: 422 })
  }
}
