import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {createClient} from '@/lib/supabase/server';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest){
  const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
  const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)return reply({error:'Bitte anmelden.'},401);
  const id=z.string().uuid().safeParse(request.nextUrl.searchParams.get('id'));if(!id.success)return reply({error:'Ungültiges Dokument.'},400);
  const {data,error}=await db.from('documents').select('storage_bucket,file_path').eq('id',id.data).eq('user_id',user.id).eq('is_archived',false).maybeSingle();
  if(error||!data||!['ema-dms','project-documents','template-documents','project-imports'].includes(data.storage_bucket))return reply({error:'Dokument nicht verfügbar.'},404);
  const signed=await db.storage.from(data.storage_bucket).createSignedUrl(data.file_path,300);
  if(signed.error||!signed.data)return reply({error:'Original konnte nicht geöffnet werden.'},503);
  const response=NextResponse.redirect(signed.data.signedUrl,303);response.headers.set('Cache-Control','private, no-store');return response;
}
