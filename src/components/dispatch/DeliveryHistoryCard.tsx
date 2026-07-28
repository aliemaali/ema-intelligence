'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { CheckCircle2, Clock3, FileText, Mail, MessageCircle, Pencil, Save, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { deleteDeliveryHistoryEntry, updateDeliveryRecipient } from '@/lib/actions/dispatch-history.actions'

interface DeliveryHistoryCardProps {
  item: {
    id: string
    projectId?: string | null
    projectName: string
    projectNumber: string
    recipientName: string
    recipientEmail?: string | null
    channel: 'email' | 'whatsapp'
    status: string
    sentAt: string
  }
}

export function DeliveryHistoryCard({ item }: DeliveryHistoryCardProps) {
  const [editing, setEditing] = useState(false)
  const [recipientName, setRecipientName] = useState(item.recipientName)
  const [pending, startTransition] = useTransition()
  const isWhatsapp = item.channel === 'whatsapp'

  function saveRecipient() {
    startTransition(async () => {
      const result = await updateDeliveryRecipient(item.id, recipientName)
      if ('error' in result && result.error) return toast.error(result.error)
      setEditing(false)
      toast.success('Empfänger aktualisiert.')
    })
  }

  function removeEntry() {
    if (!window.confirm('Diesen Eintrag wirklich aus der Versandhistorie löschen?')) return
    startTransition(async () => {
      const result = await deleteDeliveryHistoryEntry(item.id)
      if ('error' in result && result.error) return toast.error(result.error)
      toast.success('Eintrag gelöscht.')
    })
  }

  return (
    <article className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm md:p-5">
      <div className="flex items-start gap-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${isWhatsapp ? 'bg-[#5CB800]/10 text-[#4A9D00]' : 'bg-[#07142F]/8 text-[#07142F]'}`}>
          {isWhatsapp ? <MessageCircle className="h-5 w-5" /> : <Mail className="h-5 w-5" />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-extrabold text-[#07142F]">{item.projectName}</h2>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-extrabold uppercase text-slate-500">{item.projectNumber}</span>
          </div>

          {editing ? (
            <div className="mt-2 flex gap-2">
              <input value={recipientName} onChange={(event) => setRecipientName(event.target.value)} className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#5CB800]" placeholder="Name des Empfängers" />
              <button type="button" onClick={saveRecipient} disabled={pending || !recipientName.trim()} className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#5CB800] text-white disabled:opacity-50" aria-label="Speichern"><Save className="h-4 w-4" /></button>
              <button type="button" onClick={() => { setEditing(false); setRecipientName(item.recipientName) }} className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-600" aria-label="Abbrechen"><X className="h-4 w-4" /></button>
            </div>
          ) : (
            <div className="mt-1 flex items-center gap-2">
              <p className="min-w-0 flex-1 truncate text-sm text-slate-600">{item.recipientName}{item.recipientEmail ? ` · ${item.recipientEmail}` : ''}</p>
              {isWhatsapp && <button type="button" onClick={() => setEditing(true)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500" aria-label="Empfänger bearbeiten"><Pencil className="h-3.5 w-3.5" /></button>}
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-bold text-slate-500">
            <span className="inline-flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> Investment Memorandum</span>
            <span className="inline-flex items-center gap-1.5">{isWhatsapp ? <MessageCircle className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}{isWhatsapp ? 'WhatsApp' : 'E-Mail'}</span>
            <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" />{new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.sentAt))}</span>
          </div>
        </div>

        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-[10px] font-extrabold uppercase ${item.status === 'failed' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          <CheckCircle2 className="h-3.5 w-3.5" />{item.status === 'shared' ? 'Geteilt' : item.status === 'failed' ? 'Fehlgeschlagen' : 'Versendet'}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
        {item.projectId ? <Link href={`/projects/${item.projectId}/overview`} className="text-xs font-extrabold text-[#3D9200]">Projekt öffnen →</Link> : <span />}
        <button type="button" onClick={removeEntry} disabled={pending} className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-xs font-extrabold text-red-600 hover:bg-red-50 disabled:opacity-50"><Trash2 className="h-4 w-4" /> Löschen</button>
      </div>
    </article>
  )
}
