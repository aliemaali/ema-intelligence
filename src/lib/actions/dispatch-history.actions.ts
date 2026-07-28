'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Nicht angemeldet.')
  return { supabase, userId: user.id }
}

export async function deleteDeliveryHistoryEntry(id: string) {
  if (!id) return { error: 'Ungültiger Eintrag.' }
  const { supabase, userId } = await requireUser()
  const { error } = await (supabase as any)
    .from('document_deliveries')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) return { error: error.message }
  revalidatePath('/dispatch/history')
  return { success: true as const }
}

export async function updateDeliveryRecipient(id: string, recipientName: string) {
  const name = recipientName.trim()
  if (!id || !name) return { error: 'Bitte einen Empfänger angeben.' }
  const { supabase, userId } = await requireUser()
  const { error } = await (supabase as any)
    .from('document_deliveries')
    .update({ recipient_name: name })
    .eq('id', id)
    .eq('user_id', userId)

  if (error) return { error: error.message }
  revalidatePath('/dispatch/history')
  return { success: true as const }
}
