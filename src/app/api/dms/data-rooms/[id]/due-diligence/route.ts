import { createHash, randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { jsPDF } from 'jspdf'
import { createClient } from '@/lib/supabase/server'
import { getEmaVoiceUserName } from '@/lib/ema/voiceAccess'
import { buildDdAssessment, type DdFinding } from '@/lib/due-diligence/analysis'
import { getProfessionalDdChecks, type DdProjectProfile } from '@/lib/due-diligence/profiles'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses'
const MODEL = 'gpt-5.6-luna'

function safetyIdentifier(userId: string) {
  return createHash('sha256').update(userId).digest('hex')
}

function getOutputText(payload: any): string {
  if (typeof payload?.output_text === 'string') return payload.output_text.trim()
  for (const item of Array.isArray(payload?.output) ? payload.output : []) {
    for (const content of Array.isArray(item?.content) ? item.content : []) {
      if (content?.type === 'output_text' && typeof content.text === 'string') return content.text.trim()
    }
  }
  return ''
}

function buildReportPdf(name: string, assessment: ReturnType<typeof buildDdAssessment>, analyzedDocuments: number) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  let page = 1
  let y = 0

  const header = () => {
    pdf.setFillColor(6, 22, 47)
    pdf.rect(0, 0, 210, 28, 'F')
    pdf.setTextColor(255, 255, 255)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(16)
    pdf.text('EMA Due-Diligence-Bericht', 18, 13)
    pdf.setFontSize(8)
    pdf.setFont('helvetica', 'normal')
    pdf.text('KI-gestützte Vorprüfung · EMA Enterprise GmbH', 18, 20)
    pdf.setTextColor(31, 42, 68)
    y = 39
  }

  const footer = () => {
    pdf.setDrawColor(220, 226, 234)
    pdf.line(18, 282, 192, 282)
    pdf.setFontSize(7)
    pdf.setTextColor(110, 120, 138)
    pdf.text('Automatisierte Vorprüfung – keine abschließende Rechts-, Steuer- oder technische Beratung.', 18, 288)
    pdf.text(String(page), 192, 288, { align: 'right' })
  }

  const nextPage = () => {
    footer()
    pdf.addPage()
    page += 1
    header()
  }

  const writeBlock = (title: string, body: string, tone: 'normal' | 'risk' = 'normal') => {
    const bodyLines = pdf.splitTextToSize(body || '—', 166)
    const needed = 10 + bodyLines.length * 4.4
    if (y + needed > 278) nextPage()
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(10)
    pdf.setTextColor(tone === 'risk' ? 172 : 31, tone === 'risk' ? 45 : 42, tone === 'risk' ? 45 : 68)
    pdf.text(title, 18, y)
    y += 5.5
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8.5)
    pdf.setTextColor(62, 72, 91)
    pdf.text(bodyLines, 18, y)
    y += bodyLines.length * 4.4 + 5
  }

  header()
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(20)
  pdf.text(pdf.splitTextToSize(name, 170), 18, y)
  y += 18
  pdf.setFillColor(240, 246, 235)
  pdf.roundedRect(18, y, 174, 27, 3, 3, 'F')
  pdf.setTextColor(63, 133, 0)
  pdf.setFontSize(17)
  pdf.text(assessment.decision, 24, y + 11)
  pdf.setTextColor(31, 42, 68)
  pdf.setFontSize(9)
  pdf.text(`Gesamtscore ${assessment.overallScore}/100 · ${analyzedDocuments} analysierte Dokumente`, 24, y + 20)
  y += 37

  writeBlock('Management Summary', `${assessment.verifiedCount} Prüfpunkte verifiziert, ${assessment.openCount} offen und ${assessment.criticalCount} kritisch. Engineering ${assessment.lensScores.engineering}/100, Investor ${assessment.lensScores.investor}/100, Rechtliche Vorprüfung ${assessment.lensScores.legal}/100.`)
  writeBlock('Hard Gates', `${assessment.hardGateFailures.length} kritisch · ${assessment.hardGateOpen.length} ohne ausreichenden Nachweis`, assessment.hardGateFailures.length ? 'risk' : 'normal')

  assessment.findings.forEach((finding, index) => {
    const sources = finding.sources.length
      ? finding.sources.map((source) => `${source.documentName}${source.page ? `, S. ${source.page}` : ''}`).join('; ')
      : 'Kein belastbarer Dokumentnachweis.'
    writeBlock(
      `${index + 1}. ${finding.status.toUpperCase()} · ${finding.checkId}`,
      `${finding.finding}\nFolge: ${finding.consequence}\nNächster Schritt: ${finding.requiredAction}\nQuellen: ${sources}`,
      finding.status === 'critical' ? 'risk' : 'normal',
    )
  })

  footer()
  return new Uint8Array(pdf.output('arraybuffer'))
}

export async function POST(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })
  if (!getEmaVoiceUserName(user.email)) return NextResponse.json({ error: 'EMA AI ist für dieses Benutzerkonto nicht freigeschaltet.' }, { status: 403 })
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: 'EMA AI ist noch nicht mit OpenAI verbunden.' }, { status: 503 })

  const { data: room } = await (supabase as any)
    .from('dms_data_rooms')
    .select('id, name, project_id, project_profile, status')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!room) return NextResponse.json({ error: 'Datenraum nicht gefunden.' }, { status: 404 })
  if (!['pv', 'bess', 'pv_bess'].includes(room.project_profile)) {
    return NextResponse.json({ error: 'Die professionelle DD ist derzeit für PV, BESS und PV + BESS freigeschaltet.' }, { status: 422 })
  }
  const profile = room.project_profile as DdProjectProfile

  const { data: linkRows, error: linksError } = await (supabase as any)
    .from('dms_data_room_documents')
    .select('document_id')
    .eq('data_room_id', room.id)
    .eq('user_id', user.id)
  if (linksError) return NextResponse.json({ error: 'Datenraum-Dokumente konnten nicht geladen werden.' }, { status: 500 })
  const documentIds = (linkRows ?? []).map((row: any) => row.document_id)
  if (!documentIds.length) return NextResponse.json({ error: 'Der Datenraum enthält noch keine unterstützten Dokumente.' }, { status: 409 })

  const { data: documents, error: documentsError } = await (supabase as any)
    .from('documents')
    .select('id, display_name, file_name, mime_type, ai_analyzed, ai_extracted_data')
    .in('id', documentIds)
    .eq('user_id', user.id)
    .eq('is_archived', false)
  if (documentsError) return NextResponse.json({ error: 'Datenraum konnte nicht geladen werden.' }, { status: 500 })

  const pdfDocuments = (documents ?? []).filter((document: any) => document.mime_type === 'application/pdf' || String(document.file_name).toLowerCase().endsWith('.pdf'))
  const unindexed = pdfDocuments.filter((document: any) => !document.ai_analyzed || !document.ai_extracted_data)
  if (unindexed.length) {
    return NextResponse.json({ error: 'Die PDF-Dokumente müssen zuerst sicher eingelesen werden.', document_ids: unindexed.map((document: any) => document.id) }, { status: 409 })
  }
  const indexed = pdfDocuments.filter((document: any) => document.ai_analyzed && document.ai_extracted_data)
  if (!indexed.length) return NextResponse.json({ error: 'Im Datenraum befinden sich keine analysierbaren PDF-Dokumente.' }, { status: 409 })

  const { data: report, error: reportError } = await (supabase as any)
    .from('dms_due_diligence_reports')
    .insert({ user_id: user.id, project_id: room.project_id, data_room_id: room.id, project_profile: profile, status: 'analyzing' })
    .select('id')
    .single()
  if (reportError || !report) return NextResponse.json({ error: 'DD-Lauf konnte nicht angelegt werden.' }, { status: 500 })

  await (supabase as any).from('dms_data_rooms').update({ status: 'analyzing', error_message: null }).eq('id', room.id).eq('user_id', user.id)

  try {
    const checks = getProfessionalDdChecks(profile)
    const evidence = indexed.map((document: any) => ({ document_id: document.id, document_name: document.display_name, extracted: document.ai_extracted_data }))
    const schema = {
      type: 'object',
      properties: {
        findings: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              checkId: { type: 'string', enum: checks.map((check) => check.id) },
              lens: { type: 'string', enum: ['engineering', 'investor', 'legal'] },
              status: { type: 'string', enum: ['verified', 'open', 'critical'] },
              severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
              finding: { type: 'string' }, consequence: { type: 'string' }, requiredAction: { type: 'string' },
              confidence: { type: 'number', minimum: 0, maximum: 1 },
              sources: { type: 'array', items: { type: 'object', properties: { documentId: { type: 'string' }, documentName: { type: 'string' }, page: { type: ['integer', 'null'] }, excerpt: { type: 'string' } }, required: ['documentId', 'documentName', 'page', 'excerpt'], additionalProperties: false } },
            },
            required: ['checkId', 'lens', 'status', 'severity', 'finding', 'consequence', 'requiredAction', 'confidence', 'sources'],
            additionalProperties: false,
          },
        },
      },
      required: ['findings'],
      additionalProperties: false,
    }

    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json', 'OpenAI-Safety-Identifier': safetyIdentifier(user.id) },
      body: JSON.stringify({
        model: MODEL,
        reasoning: { effort: 'medium' },
        store: false,
        max_output_tokens: 7000,
        instructions: [
          'Du bist die EMA Professional Due Diligence Engine für Energieprojekte.',
          'Prüfe getrennt aus Sicht eines erfahrenen Ingenieurbüros, institutionellen Investors und einer juristischen Due-Diligence-Vorprüfung.',
          'Verwende ausschließlich die gelieferten extrahierten Dokumentinhalte. Erfinde keine Fakten und leite nichts aus Dateinamen ab.',
          'VERIFIED nur bei belastbarem Nachweis. OPEN bei fehlendem, unvollständigem oder unklarem Nachweis. CRITICAL nur bei tatsächlich belegtem schwerwiegendem Widerspruch oder Risiko.',
          'Jeder Tatsachenbefund braucht eine Quelle. Verwende Dokument-IDs exakt und Seiten nur, wenn sie in den extrahierten Daten vorhanden sind.',
          'Suche aktiv nach Widersprüchen bei Leistung, Kapazität, Flurstück, Vertragspartnern, Laufzeiten, Kosten, Netzstatus und Genehmigungsstatus.',
          'Die Legal Review ist eine automatisierte Vorprüfung und keine Rechtsberatung. Erfinde keine Rechtsnormen oder Vertragswirkungen.',
        ].join(' '),
        input: [{ role: 'user', content: [{ type: 'input_text', text: JSON.stringify({ profile, checks, evidence }) }] }],
        text: { format: { type: 'json_schema', name: 'ema_due_diligence', strict: true, schema } },
      }),
      cache: 'no-store',
    })
    const raw = await response.text()
    if (!response.ok) throw new Error('EMA konnte die Due Diligence nicht durchführen.')
    const payload = JSON.parse(raw)
    const parsed = JSON.parse(getOutputText(payload))
    const checkMap = new Map(checks.map((check) => [check.id, check]))
    const documentMap = new Map(indexed.map((document: any) => [String(document.id), document.display_name]))
    const findings: DdFinding[] = (Array.isArray(parsed.findings) ? parsed.findings : []).flatMap((finding: any) => {
      const check = checkMap.get(finding.checkId)
      if (!check) return []
      const sources = (Array.isArray(finding.sources) ? finding.sources : [])
        .filter((source: any) => documentMap.has(String(source.documentId)))
        .map((source: any) => ({ ...source, documentName: documentMap.get(String(source.documentId)) || source.documentName, excerpt: String(source.excerpt || '').slice(0, 500) }))
      const status = (finding.status === 'verified' || finding.status === 'critical') && sources.length === 0 ? 'open' : finding.status
      return [{ ...finding, lens: check.lens, status, sources } as DdFinding]
    })
    const assessment = buildDdAssessment(profile, findings)

    const pdfBytes = buildReportPdf(room.name, assessment, indexed.length)
    const pdfName = `EMA_DD_Bericht_${new Date().toISOString().slice(0, 10)}.pdf`
    const pdfPath = `${user.id}/dd-reports/${randomUUID()}-${pdfName}`
    const { error: uploadError } = await supabase.storage.from('ema-dms').upload(pdfPath, pdfBytes, { contentType: 'application/pdf', cacheControl: '3600', upsert: false })
    if (uploadError) throw new Error('DD-Bericht konnte nicht im DMS gespeichert werden.')

    const { data: reportDocument, error: documentError } = await (supabase as any)
      .from('documents')
      .insert({
        user_id: user.id, project_id: room.project_id, document_type: 'gutachten', display_name: `EMA DD-Bericht – ${room.name}`,
        file_name: pdfName, file_path: pdfPath, file_size_bytes: pdfBytes.byteLength, mime_type: 'application/pdf',
        storage_bucket: 'ema-dms', source_app: 'ema_intelligence', source_kind: 'dd_report', source_record_id: report.id,
        sha256: createHash('sha256').update(pdfBytes).digest('hex'), ai_analyzed: true, ai_extracted_data: assessment,
        ai_analyzed_at: new Date().toISOString(), analysis_status: 'completed',
      })
      .select('id')
      .single()
    if (documentError || !reportDocument) {
      await supabase.storage.from('ema-dms').remove([pdfPath])
      throw new Error('DD-Bericht konnte nicht registriert werden.')
    }

    if (room.project_id) await (supabase as any).from('dms_document_links').insert({ document_id: reportDocument.id, user_id: user.id, entity_type: 'project', entity_id: room.project_id })
    await (supabase as any).from('dms_due_diligence_reports').update({ status: 'completed', assessment, report_document_id: reportDocument.id, completed_at: new Date().toISOString(), error_message: null }).eq('id', report.id).eq('user_id', user.id)
    await (supabase as any).from('dms_data_rooms').update({ status: 'completed', error_message: null }).eq('id', room.id).eq('user_id', user.id)

    return NextResponse.json({ assessment, analyzed_documents: indexed.length, report_document_id: reportDocument.id })
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : 'EMA DD ist fehlgeschlagen.'
    await (supabase as any).from('dms_due_diligence_reports').update({ status: 'failed', error_message: message }).eq('id', report.id).eq('user_id', user.id)
    await (supabase as any).from('dms_data_rooms').update({ status: 'failed', error_message: message }).eq('id', room.id).eq('user_id', user.id)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
