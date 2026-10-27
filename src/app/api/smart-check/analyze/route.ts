import {randomUUID} from 'node:crypto'
import {assess,inputSchema} from '@/lib/smart-check/model'
import {analyzeVision} from '@/lib/smart-check/vision'
import {createShortCheckPdf} from '@/lib/smart-check/report'
import {reviewOfficialSources} from '@/lib/smart-check/source-review'
import {assertProject,assertFolder,checkContext,checkFailure,CheckError,fingerprint,loadAttachments,privateHeaders,sameOrigin} from '@/lib/smart-check/server'
export const runtime='nodejs'
export const maxDuration=120
export async function POST(request:Request){
  let context:Awaited<ReturnType<typeof checkContext>>|null=null,reportId:string|null=null
  try{
    sameOrigin(request);context=await checkContext();const {supabase,user}=context
    const raw=await request.text();if(raw.length>32000)throw new CheckError('Zu viele Projektdaten.')
    let body:unknown;try{body=JSON.parse(raw)}catch{throw new CheckError('Ungültige Prüfungsdaten.')}
    const parsed=inputSchema.safeParse(body);if(!parsed.success)throw new CheckError(parsed.error.issues[0]?.message||'Bitte Eingaben prüfen.')
    const input=parsed.data
    await Promise.all([assertProject(supabase,user.id,input.projectId),assertFolder(supabase,user.id,input.folderId)])
    const files=await loadAttachments(supabase,user.id,input.attachmentIds)
    if(files.some(f=>f.project_id && f.project_id!==input.projectId))throw new CheckError('Eine Datei gehört zu einem anderen Projekt.',403)
    let version=1,checkId=randomUUID()
    if(input.previousReportId){const {data:previous}=await supabase.from('documents').select('ai_extracted_data,version').eq('id',input.previousReportId).eq('user_id',user.id).like('source_record_id','smart-check:%').eq('analysis_status','completed').maybeSingle();if(!previous || previous.ai_extracted_data?.kind!=='ema-smart-check')throw new CheckError('Vorherige Prüfung nicht gefunden.',404);version=previous.version+1;checkId=previous.ai_extracted_data.checkId}
    if(input.mode==='ai'){
      if(process.env.SMART_CHECK_AI_ENABLED==='false')throw new CheckError('Die KI-Auswertung ist administrativ deaktiviert.',403)
      if(!process.env.OPENAI_API_KEY)throw new CheckError('KI-Anbindung nicht verfügbar. Bitte Regelprüfung verwenden.',503)
      const {count,error}=await supabase.from('documents').select('id',{count:'exact',head:true}).eq('user_id',user.id).like('source_record_id','smart-check:%').eq('ai_extracted_data->>mode','ai').gte('created_at',new Date().toISOString().slice(0,10))
      if(error || (count??0)>=20)throw new CheckError('Das Tageslimit von 20 KI-Prüfaufträgen ist erreicht oder konnte nicht geprüft werden.',429)
      const {count:monthly,error:monthlyError}=await supabase.from('documents').select('id',{count:'exact',head:true}).eq('user_id',user.id).like('source_record_id','smart-check:%').eq('ai_extracted_data->>mode','ai').gte('created_at',new Date().toISOString().slice(0,7)+'-01')
      if(monthlyError || (monthly??0)>=100)throw new CheckError('Das Monatslimit von 100 KI-Prüfaufträgen ist erreicht oder konnte nicht geprüft werden.',429)
    }
    const source=input.mode==='ai'?`smart-check:${user.id}:ai:${Math.floor(Date.now()/60000)}`:`smart-check:${randomUUID()}`
    const path=`${user.id}/smart-check/reports/${checkId}/${randomUUID()}.pdf`
    const {data:reservation,error:reserveError}=await supabase.from('documents').insert({user_id:user.id,project_id:input.projectId,folder_id:input.folderId,document_type:'gutachten',display_name:`Smart Check · ${input.title} · V${version}`,file_name:`EMA-Smart-Check-V${version}.pdf`,file_path:path,file_size_bytes:0,mime_type:'application/pdf',storage_bucket:'ema-dms',source_app:'ema_intelligence',source_kind:'dd_report',source_record_id:source,version,parent_id:input.previousReportId,analysis_status:'processing',ai_extracted_data:{kind:'ema-smart-check',mode:input.mode,checkId,input,version,startedAt:new Date().toISOString()},notes:'Automatisierte technische Vorprüfung; keine Sicherheitsfreigabe.'}).select('id').single()
    if(reserveError?.code==='23505')throw new CheckError('Bitte mindestens eine Minute zwischen KI-Prüfaufträgen warten. Kein zweiter KI-Aufruf wurde gestartet.',429)
    if(reserveError || !reservation)throw new Error('Prüfauftrag konnte nicht gespeichert werden')
    reportId=reservation.id
    const vision=input.mode==='ai'?await analyzeVision(input,files,user.id):null
    const sourceReview=await reviewOfficialSources(input.operator)
    const result=assess(input,vision,sourceReview)
    const pdf=createShortCheckPdf(input,result,version)
    if(pdf.length>40*1024*1024)throw new CheckError('Der Bericht ist zu groß. Bitte weniger Bilder verwenden.')
    const {error:uploadError}=await supabase.storage.from('ema-dms').upload(path,pdf,{contentType:'application/pdf',upsert:false})
    if(uploadError)throw new Error('Bericht konnte nicht gespeichert werden')
    const metadata={kind:'ema-smart-check',checkId,version,mode:input.mode,input,result,attachments:files.map(({id,file_name,mime_type}:any)=>({id,file_name,mime_type})),completedAt:new Date().toISOString()}
    const {data:saved,error:saveError}=await supabase.from('documents').update({file_size_bytes:pdf.length,sha256:fingerprint(pdf),analysis_status:'completed',ai_analyzed:!!vision,ai_analyzed_at:vision?new Date().toISOString():null,ai_extracted_data:metadata,notes:`EMA Smart Check · ${result.decision} · ${input.title} · ${input.address} · V${version}`}).eq('id',reportId).eq('user_id',user.id).select('id').single()
    if(saveError || !saved)throw new Error('Berichtszuordnung konnte nicht bestätigt werden')
    return Response.json({id:reportId,version,input,result,attachments:metadata.attachments},{headers:privateHeaders})
  }catch(error){if(reportId && context)await context.supabase.from('documents').update({analysis_status:'failed',analysis_error:error instanceof CheckError?error.message:'Prüfung konnte nicht abgeschlossen werden'}).eq('id',reportId).eq('user_id',context.user.id);return checkFailure(error)}
}
