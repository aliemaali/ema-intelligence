import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CURRENT_PLAUD_NOTE } from '@/lib/plaud/current-note'
import { hidePlaudTranslationProgress } from '@/lib/plaud/prepare-meeting'
import { buildPlaudNotePdf, safePlaudPdfFilename, type PlaudNotePdfAssets } from '@/lib/plaud/note-pdf'
import { loadPlaudPdfAssets } from '@/lib/plaud/note-pdf-assets'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

let assetsCache: PlaudNotePdfAssets | null = null

function pdfAssets() {
  if (assetsCache) return assetsCache
  assetsCache = loadPlaudPdfAssets()
  return assetsCache
}

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })

  const language = request.nextUrl.searchParams.get('language') === 'original' ? 'original' : 'de'
  const download = request.nextUrl.searchParams.get('download') === '1'
  const { data: note, error } = await supabase.from('plaud_notes')
    .select('id,external_id,title,recorded_at,duration_ms,source_language,summary_original,summary_de,transcript_original,transcript_de')
    .eq('id', params.id).eq('user_id', user.id).maybeSingle()
  if (error) return NextResponse.json({ error: 'PLAUD-Notiz konnte nicht geladen werden.' }, { status: 500 })
  if (!note) return NextResponse.json({ error: 'PLAUD-Notiz wurde nicht gefunden.' }, { status: 404 })

  try {
    const transcriptDe = hidePlaudTranslationProgress(note.transcript_de)
    const legacy = note.external_id === CURRENT_PLAUD_NOTE.externalId && !transcriptDe
    const legacySummary = legacy ? CURRENT_PLAUD_NOTE.sections.map(([heading, text]) => `${heading}\n${text}`).join('\n\n') : ''
    const summary = language === 'original'
      ? note.summary_original || note.summary_de || legacySummary
      : note.summary_de || note.summary_original || legacySummary
    const transcript = legacy ? '' : language === 'original'
      ? note.transcript_original || ''
      : transcriptDe || ''
    const pdf = buildPlaudNotePdf({
      title: note.title,
      recordedAt: note.recorded_at,
      durationMs: note.duration_ms,
      language,
      sourceLanguage: note.source_language,
      summary,
      transcript,
      translationPending: language === 'de' && !transcriptDe && Boolean(note.transcript_original),
    }, pdfAssets())
    const filename = safePlaudPdfFilename(note.title, language)

    return new NextResponse(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${filename}"`,
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',
        'Content-Security-Policy': "frame-ancestors 'self'",
      },
    })
  } catch (pdfError) {
    console.error('PLAUD PDF generation failed:', pdfError instanceof Error ? pdfError.message : 'unknown error')
    return NextResponse.json({ error: 'Die PDF-Vorschau konnte nicht erzeugt werden.' }, { status: 500 })
  }
}
