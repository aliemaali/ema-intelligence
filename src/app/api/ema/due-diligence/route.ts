import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEmaVoiceUserName } from '@/lib/ema/voiceAccess'
import { getProfessionalDdChecks, type DdProjectProfile } from '@/lib/due-diligence/profiles'
import { buildDdAssessment, type DdFinding } from '@/lib/due-diligence/analysis'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses'
const MODEL = 'gpt-5.6-luna'

function safetyIdentifier(userId: string) { return createHash('sha256').update(userId).digest('hex') }
function getOutputText(payload: any): string {
  if (typeof payload?.output_text === 'string') return payload.output_text.trim()
  for (const item of Array.isArray(payload?.output) ? payload.output : []) for (const content of Array.isArray(item?.content) ? item.content : []) if (content?.type === 'output_text' && typeof content.text === 'string') return content.text.trim()
  return ''
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })
  if (!getEmaVoiceUserName(user.email)) return NextResponse.json({ error: 'EMA AI ist für dieses Benutzerkonto nicht freigeschaltet.' }, { status: 403 })
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: 'EMA AI ist noch nicht mit OpenAI verbunden.' }, { status: 503 })

  const body = await request.json().catch(() => ({}))
  const projectId = typeof body.project_id === 'string' ? body.project_id : ''
  const profile: DdProjectProfile | null = ['bess','pv','pv_bess'].includes(body.profile) ? body.profile : null
  if (!projectId || !profile) return NextResponse.json({ error: 'Projekt und Prüfprofil fehlen.' }, { status: 400 })

  const { data: documents, error } = await supabase.from('documents').select('id, display_name, ai_analyzed, ai_extracted_data').eq('project_id', projectId).eq('user_id', user.id).eq('is_archived', false)
  if (error) return NextResponse.json({ error: 'Datenraum konnte nicht geladen werden.' }, { status: 500 })
  const indexed = (documents ?? []).filter((d: any) => d.ai_analyzed && d.ai_extracted_data)
  if (!indexed.length) return NextResponse.json({ error: 'Noch keine analysierten PDF-Dokumente im Datenraum. Bitte Dokumente zuerst mit EMA einlesen.' }, { status: 409 })

  const checks = getProfessionalDdChecks(profile)
  const evidence = indexed.map((d: any) => ({ document_id: d.id, document_name: d.display_name, extracted: d.ai_extracted_data }))
  const schema = {
    type:'object', properties:{ findings:{ type:'array', items:{ type:'object', properties:{ checkId:{type:'string'}, lens:{type:'string',enum:['engineering','investor','legal']}, status:{type:'string',enum:['verified','open','critical']}, severity:{type:'string',enum:['low','medium','high','critical']}, finding:{type:'string'}, consequence:{type:'string'}, requiredAction:{type:'string'}, confidence:{type:'number'}, sources:{type:'array',items:{type:'object',properties:{documentId:{type:'string'},documentName:{type:'string'},page:{type:['integer','null']},excerpt:{type:'string'}},required:['documentId','documentName','page','excerpt'],additionalProperties:false}}}, required:['checkId','lens','status','severity','finding','consequence','requiredAction','confidence','sources'], additionalProperties:false } } }, required:['findings'], additionalProperties:false
  }

  const response = await fetch(OPENAI_RESPONSES_URL, { method:'POST', headers:{ Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json','OpenAI-Safety-Identifier':safetyIdentifier(user.id)}, body:JSON.stringify({ model:MODEL, reasoning:{effort:'medium'}, store:false, max_output_tokens:7000, instructions:[
    'Du bist die EMA Professional Due Diligence Engine für Energieprojekte.',
    'Prüfe getrennt aus Sicht eines erfahrenen Ingenieurbüros, institutionellen Investors und einer juristischen Due-Diligence-Vorprüfung.',
    'Verwende ausschließlich die gelieferten extrahierten Dokumentinhalte. Erfinde keine Fakten und leite nichts aus Dateinamen ab.',
    'VERIFIED nur wenn der gelieferte Inhalt den Prüfpunkt positiv und belastbar belegt. OPEN wenn Nachweis fehlt, unvollständig, abgelaufen oder nicht eindeutig ist. CRITICAL nur bei einem tatsächlich belegten schwerwiegenden Widerspruch/Risiko.',
    'Jeder positive oder negative Tatsachenbefund braucht eine Quelle. Verwende die dokument_id exakt. Seiten nur übernehmen, wenn sie in den extrahierten Daten vorhanden sind.',
    'Suche aktiv nach Widersprüchen bei Leistung, Kapazität, Flurstück, Vertragspartnern, Laufzeiten, Kosten, Netzstatus und Genehmigungsstatus.',
    'Die Legal Review ist eine automatisierte Vorprüfung und keine Rechtsberatung. Keine erfundenen Rechtsnormen oder Vertragswirkungen.',
  ].join(' '), input:[{role:'user',content:[{type:'input_text',text:JSON.stringify({profile,checks,evidence})}]}], text:{format:{type:'json_schema',name:'ema_due_diligence',strict:true,schema}} }), cache:'no-store' })
  const raw = await response.text()
  if (!response.ok) return NextResponse.json({ error:'EMA konnte die Due Diligence nicht durchführen.' }, { status:502 })
  let payload:any; try { payload=JSON.parse(raw) } catch { return NextResponse.json({error:'Ungültige EMA-Antwort.'},{status:502}) }
  let parsed:any; try { parsed=JSON.parse(getOutputText(payload)) } catch { return NextResponse.json({error:'EMA erhielt keine strukturierte DD.'},{status:502}) }
  const allowed = new Set(checks.map(c => c.id))
  const findings = (Array.isArray(parsed.findings) ? parsed.findings : []).filter((f:any) => allowed.has(f.checkId)) as DdFinding[]
  return NextResponse.json({ assessment: buildDdAssessment(profile, findings), analyzed_documents:indexed.length })
}
