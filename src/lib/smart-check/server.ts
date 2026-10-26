import { createHash } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
export const MAX_FILE = 3 * 1024 * 1024
export class CheckError extends Error { status:number; constructor(message: string, status=400) { super(message);this.status=status } }
export async function checkContext() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if(error || !user) throw new CheckError('Bitte anmelden.',401)
  const { data:profile,error:profileError }=await supabase.from('profiles').select('role,is_active').eq('id',user.id).maybeSingle()
  if(profileError || !profile || !profile.is_active || ['partner','sales_partner','vertriebspartner'].includes(String(profile.role).toLowerCase())) throw new CheckError('Kein interner Smart-Check-Zugriff.',403)
  const {data:assurance,error:mfaError}=await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if(mfaError || (assurance?.nextLevel==='aal2' && assurance.currentLevel!=='aal2')) throw new CheckError('Bitte die Zwei-Faktor-Anmeldung abschließen.',403)
  return {supabase,user}
}
export function sameOrigin(request:Request) {
  const origin=request.headers.get('origin')
  if(!origin || origin!==new URL(request.url).origin) throw new CheckError('Ungültige Anfragequelle.',403)
}
export const privateHeaders={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}
export function checkFailure(error:unknown) {
  if(error instanceof CheckError) return Response.json({error:error.message},{status:error.status,headers:privateHeaders})
  console.error('[smart-check] request failed',error instanceof Error ? error.message : 'unknown')
  return Response.json({error:'Smart Check konnte den Vorgang nicht abschließen. Bitte erneut versuchen.'},{status:500,headers:privateHeaders})
}
export async function assertProject(supabase:any,userId:string,projectId:string|null) {
  if(!projectId)return
  const {data,error}=await supabase.from('projects').select('id').eq('id',projectId).eq('user_id',userId).eq('is_archived',false).maybeSingle()
  if(error || !data)throw new CheckError('Projekt nicht verfügbar.',403)
}
export async function assertFolder(supabase:any,userId:string,folderId:string|null) {
  if(!folderId)return
  const {data,error}=await supabase.from('document_folders').select('id').eq('id',folderId).eq('user_id',userId).maybeSingle()
  if(error || !data)throw new CheckError('Ordner nicht verfügbar.',403)
}
export function validateFile(mime:string,bytes:Uint8Array) {
  if(!bytes.length || bytes.length>MAX_FILE)throw new CheckError('Maximal 3 MB je Datei. Bilder bitte vor dem Upload verkleinern.')
  const buffer=Buffer.from(bytes)
  if(mime==='application/pdf') {
    if(buffer.subarray(0,5).toString('ascii')!=='%PDF-')throw new CheckError('Ungültige PDF-Datei.')
    if(/\/(JavaScript|JS|Launch|EmbeddedFile|OpenAction)\b/.test(buffer.toString('latin1')))throw new CheckError('PDFs mit aktiven oder eingebetteten Inhalten sind nicht zugelassen.')
    return
  }
  let width=0,height=0
  if(mime==='image/png' && buffer.length>=24 && buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) {width=buffer.readUInt32BE(16);height=buffer.readUInt32BE(20)}
  else if(mime==='image/jpeg' && buffer[0]===255 && buffer[1]===216) {
    let offset=2
    while(offset+8<buffer.length){ if(buffer[offset]!==255)break;const marker=buffer[offset+1];if(marker===217 || marker===218)break;const len=buffer.readUInt16BE(offset+2);if(len<2 || offset+2+len>buffer.length)break;if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)){height=buffer.readUInt16BE(offset+5);width=buffer.readUInt16BE(offset+7);break}offset+=2+len }
  } else throw new CheckError('Nur JPG, PNG und PDF mit passendem Dateiinhalt sind erlaubt.')
  if(!width || !height || width>8192 || height>8192 || width*height>16000000)throw new CheckError('Bild nicht lesbar oder zu groß. Bitte als JPG mit maximal 16 Megapixeln erneut aufnehmen.')
}
export function fingerprint(bytes:Uint8Array){return createHash('sha256').update(bytes).digest('hex')}
export async function loadAttachments(supabase:any,userId:string,ids:string[]) {
  if(!ids.length)return []
  if(new Set(ids).size!==ids.length)throw new CheckError('Eine Datei wurde mehrfach zugeordnet.')
  const {data,error}=await supabase.from('documents').select('id,user_id,project_id,file_name,file_path,mime_type,file_size_bytes,sha256,storage_bucket').eq('user_id',userId).eq('is_archived',false).in('id',ids)
  if(error || data?.length!==ids.length)throw new CheckError('Eine Datei ist nicht mehr verfügbar.',403)
  return Promise.all(data.map(async(doc:any)=>{
    if(doc.storage_bucket!=='ema-dms' || !doc.file_path.startsWith(`${userId}/smart-check/`) || doc.file_size_bytes>MAX_FILE)throw new CheckError('Ungültige Prüfdatei.',403)
    const {data:blob,error}=await supabase.storage.from('ema-dms').download(doc.file_path)
    if(error || !blob)throw new CheckError('Originaldatei konnte nicht geladen werden.',502)
    const bytes=new Uint8Array(await blob.arrayBuffer());validateFile(doc.mime_type,bytes)
    if(doc.sha256!==fingerprint(bytes))throw new CheckError('Dateiinhalt wurde verändert.',409)
    return {...doc,bytes}
  }))
}
