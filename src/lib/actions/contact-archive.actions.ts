'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type ContactArchiveKind = 'investor'|'partner'
type Result = { success:true }|{ success:false; error:string }

function tableFor(kind:ContactArchiveKind) { return kind === 'investor' ? 'investors' : 'partners' }

async function authenticatedClient() {
  const supabase = await createClient()
  const { data:{ user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Nicht angemeldet')
  return { supabase,user }
}

function revalidateContacts() {
  revalidatePath('/investors')
  revalidatePath('/partners')
  revalidatePath('/archive')
  revalidatePath('/archive/contacts')
}

export async function archiveContact(kind:ContactArchiveKind,id:string):Promise<Result> {
  if (!id) return { success:false,error:'Kontakt-ID fehlt.' }
  const { supabase } = await authenticatedClient()
  const { data,error } = await supabase.from(tableFor(kind)).update({ is_active:false,updated_at:new Date().toISOString() } as never).eq('id',id).eq('is_active',true).select('id').maybeSingle()
  if (error) return { success:false,error:'Kontakt konnte nicht archiviert werden.' }
  if (!data) return { success:false,error:'Kontakt wurde nicht gefunden oder ist bereits archiviert.' }
  revalidateContacts()
  return { success:true }
}

export async function restoreArchivedContact(kind:ContactArchiveKind,id:string):Promise<Result> {
  if (!id) return { success:false,error:'Kontakt-ID fehlt.' }
  const { supabase } = await authenticatedClient()
  const { data,error } = await supabase.from(tableFor(kind)).update({ is_active:true,updated_at:new Date().toISOString() } as never).eq('id',id).eq('is_active',false).select('id').maybeSingle()
  if (error) return { success:false,error:'Kontakt konnte nicht wiederhergestellt werden.' }
  if (!data) return { success:false,error:'Archivierter Kontakt wurde nicht gefunden.' }
  revalidateContacts()
  return { success:true }
}

export async function permanentlyDeleteArchivedContact(kind:ContactArchiveKind,id:string):Promise<Result> {
  if (!id) return { success:false,error:'Kontakt-ID fehlt.' }
  const { supabase } = await authenticatedClient()
  const { data,error } = await supabase.from(tableFor(kind)).delete().eq('id',id).eq('is_active',false).select('id').maybeSingle()
  if (error) return { success:false,error:'Kontakt konnte nicht endgültig gelöscht werden.' }
  if (!data) return { success:false,error:'Nur archivierte Kontakte können endgültig gelöscht werden.' }
  revalidateContacts()
  return { success:true }
}
