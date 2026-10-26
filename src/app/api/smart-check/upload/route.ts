import {randomUUID} from 'node:crypto'
import {assertFolder,assertProject,checkContext,checkFailure,fingerprint,MAX_FILE,privateHeaders,sameOrigin,validateFile,CheckError} from '@/lib/smart-check/server'
export const runtime='nodejs'
export async function POST(request:Request){
  let context:Awaited<ReturnType<typeof checkContext>>|null=null,path:string|null=null
  try{
    sameOrigin(request);context=await checkContext()
    const {supabase,user}=context
    const form=await request.formData(),file=form.get('file')
    if(!(file instanceof File) || file.size>MAX_FILE)throw new CheckError('Bitte eine Datei bis 3 MB auswählen.')
    const projectId=String(form.get('projectId')||'')||null,folderId=String(form.get('folderId')||'')||null
    if([projectId,folderId].some(id=>id && !/^[a-f0-9-]{36}$/i.test(id)))throw new CheckError('Ungültige Zuordnung.')
    await Promise.all([assertProject(supabase,user.id,projectId),assertFolder(supabase,user.id,folderId)])
    const bytes=new Uint8Array(await file.arrayBuffer());validateFile(file.type,bytes)
    const sha=fingerprint(bytes)
    const {data:existing}=await supabase.from('documents').select('id,file_name,mime_type').eq('user_id',user.id).eq('sha256',sha).eq('is_archived',false).like('file_path',`${user.id}/smart-check/%`).maybeSingle()
    if(existing)return Response.json({document:existing},{headers:privateHeaders})
    const ext=file.type==='application/pdf'?'pdf':file.type==='image/png'?'png':'jpg'
    path=`${user.id}/smart-check/assets/${randomUUID()}.${ext}`
    const {error:uploadError}=await supabase.storage.from('ema-dms').upload(path,bytes,{contentType:file.type,upsert:false})
    if(uploadError)throw new Error('Dateispeicherung fehlgeschlagen')
    const name=file.name.replace(/[\r\n\\/]/g,'_').slice(0,180)
    const {data,error}=await supabase.from('documents').insert({user_id:user.id,project_id:projectId,folder_id:folderId,document_type:ext==='pdf'?'sonstiges':'bild',display_name:`Smart Check · ${name}`,file_name:name,file_path:path,file_size_bytes:bytes.length,mime_type:file.type,storage_bucket:'ema-dms',source_app:'ema_intelligence',source_kind:'project',source_record_id:`smart-check-asset:${randomUUID()}`,sha256:sha,notes:'EMA Smart Check · Originaldatei; noch keine technische Auswertung',analysis_status:'not_started'}).select('id,file_name,mime_type').single()
    if(error || !data)throw new Error('Dateizuordnung fehlgeschlagen')
    path=null
    return Response.json({document:data},{headers:privateHeaders})
  }catch(error){if(path && context)await context.supabase.storage.from('ema-dms').remove([path]).catch(()=>undefined);return checkFailure(error)}
}
