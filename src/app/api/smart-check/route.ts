import {checkContext,checkFailure,privateHeaders,CheckError} from '@/lib/smart-check/server'
export const dynamic='force-dynamic'
export async function GET(request:Request){try{
  const {supabase,user}=await checkContext(),url=new URL(request.url),id=url.searchParams.get('id')
  if(id){if(!/^[a-f0-9-]{36}$/i.test(id))throw new CheckError('Ungültige Prüfung.');const {data,error}=await supabase.from('documents').select('id,version,ai_extracted_data').eq('user_id',user.id).eq('id',id).like('source_record_id','smart-check:%').eq('analysis_status','completed').eq('is_archived',false).maybeSingle();if(error || data?.ai_extracted_data?.kind!=='ema-smart-check')throw new CheckError('Prüfung nicht gefunden.',404);return Response.json({id:data.id,...data.ai_extracted_data},{headers:privateHeaders})}
  const [projects,folders,reports]=await Promise.all([
    supabase.from('projects').select('id,project_name,project_number').eq('user_id',user.id).eq('is_archived',false).order('project_name'),
    supabase.from('document_folders').select('id,name').eq('user_id',user.id).order('name'),
    supabase.from('documents').select('id,display_name,created_at,version,project_id').eq('user_id',user.id).like('source_record_id','smart-check:%').eq('analysis_status','completed').eq('is_archived',false).order('created_at',{ascending:false}).limit(30),
  ])
  if(projects.error || folders.error || reports.error)throw new Error('Stammdaten konnten nicht geladen werden')
  return Response.json({projects:projects.data||[],folders:folders.data||[],reports:reports.data||[],aiAvailable:!!process.env.OPENAI_API_KEY},{headers:privateHeaders})
}catch(error){return checkFailure(error)}}
