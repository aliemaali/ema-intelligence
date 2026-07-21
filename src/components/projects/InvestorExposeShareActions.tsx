'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Download, Mail, MessageCircle } from 'lucide-react'
import { generateMemorandumPdf, type MemorandumPdfData } from '@/lib/pdf/memorandumPdf'

function filename(data: MemorandumPdfData) {
  const safe = `${data.projectNumber}_${data.projectName}`
    .replace(/[^\p{L}\p{N}_-]+/gu, '_')
    .replace(/_+/g, '_')
    .slice(0, 90)
  return `EMA_Expose_${safe}.pdf`
}

interface Props {
  projectId: string
  investorEmail?: string | null
  data: MemorandumPdfData
}

export function InvestorExposeShareActions({ projectId, investorEmail, data }: Props) {
  const [busy, setBusy] = useState<string | null>(null)

  async function createFile() {
    const blob = await generateMemorandumPdf(data)
    return new File([blob], filename(data), { type: 'application/pdf' })
  }

  async function downloadPdf() {
    if (busy) return
    setBusy('download')
    try {
      const file = await createFile()
      const url = URL.createObjectURL(file)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = file.name
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 120000)
    } catch (error) {
      console.error(error)
      window.alert('Die PDF konnte nicht erstellt werden.')
    } finally {
      setBusy(null)
    }
  }

  async function sharePdf(channel: 'outlook' | 'whatsapp') {
    if (busy) return
    setBusy(channel)
    try {
      const file = await createFile()
      const shareData: ShareData = {
        title: `Projekt-Exposé ${data.projectNumber}`,
        text: channel === 'outlook'
          ? `Projekt-Exposé ${data.projectNumber} – ${data.projectName}${investorEmail ? `\nEmpfänger: ${investorEmail}` : ''}`
          : `Projekt-Exposé ${data.projectNumber} – ${data.projectName}`,
        files: [file],
      }

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share(shareData)
        return
      }

      const url = URL.createObjectURL(file)
      window.location.href = url
      window.setTimeout(() => URL.revokeObjectURL(url), 120000)
      window.alert('Die PDF wurde geöffnet. Tippe auf Teilen und wähle Outlook oder WhatsApp.')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      console.error(error)
      window.alert('Die PDF konnte nicht geteilt werden.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-wrap gap-2 border-t border-border pt-3">
      <Link href={`/expose/${projectId}`} className="btn-secondary btn-sm">Exposé öffnen</Link>
      <button type="button" onClick={downloadPdf} disabled={Boolean(busy)} className="btn-secondary btn-sm inline-flex items-center gap-1.5">
        <Download className="h-4 w-4" /> {busy === 'download' ? 'PDF wird erstellt…' : 'PDF herunterladen'}
      </button>
      <button type="button" onClick={() => sharePdf('outlook')} disabled={Boolean(busy)} className="btn-primary btn-sm inline-flex items-center gap-1.5">
        <Mail className="h-4 w-4" /> {busy === 'outlook' ? 'PDF wird erstellt…' : 'Per Outlook senden'}
      </button>
      <button type="button" onClick={() => sharePdf('whatsapp')} disabled={Boolean(busy)} className="btn-secondary btn-sm inline-flex items-center gap-1.5">
        <MessageCircle className="h-4 w-4" /> {busy === 'whatsapp' ? 'PDF wird erstellt…' : 'Über WhatsApp teilen'}
      </button>
    </div>
  )
}
