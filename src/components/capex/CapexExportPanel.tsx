'use client'

import { useState } from 'react'
import { Download, Mail, Save } from 'lucide-react'
import type { CapexCalcResult, CapexProject } from '@/lib/types/capex.types'
import { createClient } from '@/lib/supabase/client'
import { createDocumentRecord } from '@/lib/actions/document.actions'
import { createCapexReport } from '@/lib/capex/createCapexReport'

interface CapexExportPanelProps {
  project: CapexProject
  calc: CapexCalcResult
}

function safeName(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9äöüÄÖÜß_-]+/g, '_').replace(/^_+|_+$/g, '') || 'Projekt'
}

async function blobToBase64(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  }
  return btoa(binary)
}

export function CapexExportPanel({ project, calc }: CapexExportPanelProps) {
  const isTurnkey = project.componentPricing.acquisition.mode === 'turnkey'
  const reportLabel = isTurnkey ? 'Amortisationsberechnung' : 'CAPEX-Kalkulation'
  const [recipient, setRecipient] = useState('')
  const [subject, setSubject] = useState(`${reportLabel} – ${project.projektname || project.calculationName}`)
  const [message, setMessage] = useState(`Sehr geehrte Damen und Herren,\n\nanbei erhalten Sie die ${reportLabel} zum Projekt.\n\nMit freundlichen Grüßen\nEMA Enterprise GmbH`)
  const [busy, setBusy] = useState<'download' | 'save' | 'send' | null>(null)
  const [status, setStatus] = useState('')
  const supabase = createClient()
  const isoDate = new Date().toISOString().slice(0, 10)
  const fileName = `EMA_${isTurnkey ? 'Amortisation' : 'CAPEX'}_${safeName(project.projektname || project.calculationName)}_${isoDate}.pdf`

  async function savePdf(blob: Blob) {
    if (!project.projectId) throw new Error('Kein Projekt zugeordnet.')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Nicht angemeldet.')
    const path = `${user.id}/${project.projectId}/${Date.now()}_${fileName}`
    const { error: uploadError } = await supabase.storage.from('project-documents').upload(path, blob, { contentType: 'application/pdf', cacheControl: '3600' })
    if (uploadError) throw uploadError
    const result = await createDocumentRecord({
      projectId: project.projectId,
      displayName: `${reportLabel} – ${project.projektname || project.calculationName}`,
      fileName,
      filePath: path,
      fileSizeBytes: blob.size,
      mimeType: 'application/pdf',
      documentType: 'sonstiges',
    })
    if (result.error) {
      await supabase.storage.from('project-documents').remove([path])
      throw new Error(result.error)
    }
  }

  async function run(mode: 'download' | 'save' | 'send') {
    if (busy) return
    setBusy(mode)
    setStatus('PDF wird erstellt…')
    try {
      const blob = await createCapexReport(project, calc)
      if (mode === 'download') {
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = fileName
        anchor.click()
        setTimeout(() => URL.revokeObjectURL(url), 60000)
        setStatus('PDF wurde erstellt.')
        return
      }

      setStatus('PDF wird in EMA gespeichert…')
      await savePdf(blob)
      if (mode === 'save') {
        setStatus('PDF wurde im Projekt gespeichert.')
        return
      }

      if (!recipient.trim()) throw new Error('Bitte Empfänger-E-Mail eintragen.')
      setStatus('E-Mail wird über Microsoft 365 versendet…')
      const response = await fetch('/api/microsoft/send-mail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: recipient, subject, body: message, fileName, contentBytes: await blobToBase64(blob) }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Versand fehlgeschlagen.')
      setStatus('PDF wurde gespeichert und versendet.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Vorgang fehlgeschlagen.')
    } finally {
      setBusy(null)
    }
  }

  return <div className="space-y-4 rounded-[1.5rem] bg-white p-4 shadow-sm md:p-6">
    <div><h3 className="text-lg font-extrabold text-[#1F2A44]">{isTurnkey ? 'Amortisations-PDF' : 'CAPEX-PDF'}</h3><p className="mt-1 text-sm text-slate-500">Zweiseitigen EMA-Report erstellen, im Projekt speichern und direkt über Microsoft 365 versenden.</p></div>
    <div className="grid gap-3 sm:grid-cols-2"><input type="email" value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="Empfänger-E-Mail" className="form-input" /><input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Betreff" className="form-input" /></div>
    <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={6} className="form-input w-full resize-y" />
    <div className="grid gap-2 sm:grid-cols-3">
      <button onClick={() => run('download')} disabled={Boolean(busy)} className="btn-secondary justify-center"><Download className="h-4 w-4" /> {busy === 'download' ? 'Erstellt…' : 'PDF erstellen'}</button>
      <button onClick={() => run('save')} disabled={Boolean(busy)} className="btn-secondary justify-center"><Save className="h-4 w-4" /> {busy === 'save' ? 'Speichert…' : 'PDF speichern'}</button>
      <button onClick={() => run('send')} disabled={Boolean(busy)} className="btn-primary justify-center"><Mail className="h-4 w-4" /> {busy === 'send' ? 'Versendet…' : 'Speichern & versenden'}</button>
    </div>
    {status && <div role="status" className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-[#1F2A44]">{status}</div>}
    <p className="text-xs leading-5 text-slate-500">Für den Versand muss Microsoft 365 verbunden sein. Gegebenenfalls ist einmaliges Trennen und erneutes Verbinden erforderlich.</p>
  </div>
}
