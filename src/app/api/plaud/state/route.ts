import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { hasPlaudConnection } from '@/lib/plaud/session'

export const dynamic = 'force-dynamic'

export async function GET(){
  const supabase=await createClient()
  const{data:{user}}=await supabase.auth.getUser()
  if(!user)return NextResponse.json({error:'unauthorized'},{status:401})
  const[items,notes,connected]=await Promise.all([
    supabase.from('plaud_items').select('id,external_id,note_external_id,kind,title,detail,source,status,due_at').eq('user_id',user.id).order('created_at',{ascending:true}),
    supabase.from('plaud_notes').select('id,external_id,title,recorded_at,duration_ms,source_language,summary_original,summary_de,archived_at,imported_at').eq('user_id',user.id).order('recorded_at',{ascending:false}),
    hasPlaudConnection(user.id).catch(()=>false),
  ])
  if(items.error||notes.error)return NextResponse.json({error:'PLAUD-Daten konnten nicht geladen werden.'},{status:500})
  return NextResponse.json({items:items.data??[],notes:notes.data??[],connected})
}
