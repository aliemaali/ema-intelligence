'use client'

import { useMemo, useState } from 'react'
import { Check, Contact, FileText, Mail, MessageCircle, Send, X } from 'lucide-react'
import { toast } from 'sonner'
import { generateMemorandumPdf } from '@/lib/pdf/memorandumPdf'
import { getBulkMemorandumData, recordMemorandumDeliveries } from '@/lib/actions/bulk-memorandum.actions'

interface ProjectOption { id: string; name: string; number: string; location: string; typeLabel: string }
interface RecipientOption { id: string; name: string; email: string; type: 'investor' | 'partner' }
interface DeviceContact { name: string; phone: string }
interface BulkMemorandumCenterProps { projects: ProjectOption[]; recipients: RecipientOption[] }
type DeliveryRecipient = RecipientOption | { name: string; email: string; type: 'manual' } | { name: string; type: 'manual' }
interface PreparedShare { files: File[]; projectIds: string[]; recipients: DeliveryRecipient[] }

function safeFileName(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9äöüÄÖÜß_-]+/g, '_').replace(/^_+|_+$/g, '') || 'Projekt'
}

async function blobToBase64(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  return btoa(binary)
}

function isAppleMobile() {
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function isBlockedShareError(error: unknown) {
  return error instanceof DOMException && ['NotAllowedError', 'SecurityError'].includes(error.name)
}

export function BulkMemorandumCenter({ projects, recipients }: BulkMemorandumCenterProps) {
  const [open, setOpen] = useState(false)
  const [selectedProjects, setSelectedProjects] = useState<string[]>([])
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([])
  const [manualEmail, setManualEmail] = useState('')
  const [deviceContact, setDeviceContact] = useState<DeviceContact | null>(null)
  const [manualPhone, setManualPhone] = useState('')
  const [channel, setChannel] = useState<'email' | 'whatsapp'>('email')
  const [busy, setBusy] = useState(false)
  const [preparedShare, setPreparedShare] = useState<PreparedShare | null>(null)

  const recipientMap = useMemo(() => new Map(recipients.map((item) => [item.id, item])), [recipients])
  const allSelected = projects.length > 0 && selectedProjects.length === projects.length

  function clearPreparedShare() {
    setPreparedShare(null)
  }

  function toggleProject(id: string) {
    clearPreparedShare()
    setSelectedProjects((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  function toggleRecipient(id: string) {
    clearPreparedShare()
    setSelectedRecipients((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  function changeChannel(nextChannel: 'email' | 'whatsapp') {
    clearPreparedShare()
    setChannel(nextChannel)
  }

  async function pickDeviceContact() {
    if (isAppleMobile()) {
      toast.info('Auf dem iPhone wählst du den Kontakt nach dem Tippen auf „Jetzt WhatsApp öffnen“ im Teilen-Menü aus.')
      return
    }

    type ContactPickerNavigator = Navigator & { contacts?: { select: (properties: Array<'name' | 'tel'>, options: { multiple: boolean }) => Promise<Array<{ name?: string[]; tel?: string[] }>> } }
    const contactNavigator = navigator as ContactPickerNavigator
    if (!contactNavigator.contacts?.select) {
      toast.info('Die Kontaktauswahl wird auf diesem Gerät nicht unterstützt. Bitte Telefonnummer eingeben oder den Kontakt später in WhatsApp auswählen.')
      return
    }

    try {
      const selected = await contactNavigator.contacts.select(['name', 'tel'], { multiple: false })
      const contact = selected[0]
      const phone = contact?.tel?.[0]?.trim() || ''
      if (!phone) return toast.error('Der ausgewählte Kontakt enthält keine Telefonnummer.')
      const name = contact?.name?.[0]?.trim() || phone
      clearPreparedShare()
      setDeviceContact({ name, phone })
      setManualPhone(phone)
    } catch (error) {
      if (error instanceof DOMException && ['AbortError', 'NotAllowedError', 'SecurityError'].includes(error.name)) return
      toast.error('Der Kontakt konnte nicht übernommen werden.')
    }
  }

  function resetCenter() {
    setOpen(false)
    setSelectedProjects([])
    setSelectedRecipients([])
    setManualEmail('')
    setDeviceContact(null)
    setManualPhone('')
    setPreparedShare(null)
  }

  async function sharePreparedFiles() {
    if (!preparedShare) return
    const { files, projectIds, recipients: deliveryRecipients } = preparedShare

    if (!navigator.share || !navigator.canShare?.({ files })) {
      toast.error('Das Teilen dieser PDFs wird auf diesem Gerät nicht unterstützt.')
      return
    }

    setBusy(true)
    try {
      // Dieser Aufruf läuft direkt im zweiten Tastendruck. Dadurch bleibt die von iOS
      // verlangte Benutzeraktivierung erhalten, auch wenn die PDF-Erstellung länger dauert.
      await navigator.share({ files })
      toast.success('WhatsApp-Teilen wurde abgeschlossen.')
      resetCenter()
      void recordMemorandumDeliveries({
        projectIds,
        recipients: deliveryRecipients,
        channel: 'whatsapp',
        status: 'shared',
      }).catch(() => undefined)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      if (isBlockedShareError(error)) {
        toast.error('Das iPhone hat das Teilen blockiert. Bitte tippe erneut direkt auf „Jetzt WhatsApp öffnen“.')
        return
      }
      toast.error(error instanceof Error ? error.message : 'WhatsApp-Teilen fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  async function dispatch() {
    if (!selectedProjects.length) return toast.error('Bitte mindestens ein Projekt auswählen.')
    if (channel === 'email' && !selectedRecipients.length && !manualEmail.trim()) return toast.error('Bitte mindestens einen Empfänger auswählen.')

    setBusy(true)
    try {
      const result = await getBulkMemorandumData(selectedProjects)
      if (!result.success || !result.data.length) throw new Error('Keine Exposés konnten erstellt werden.')

      const generated: Array<{ projectId: string; name: string; file: File; contentBytes?: string }> = []
      for (const item of result.data) {
        const blob = await generateMemorandumPdf(item.data)
        const name = `EMA_Expose_${safeFileName(item.data.projectName)}.pdf`
        generated.push({
          projectId: item.projectId,
          name,
          file: new File([blob], name, { type: 'application/pdf' }),
          contentBytes: channel === 'email' ? await blobToBase64(blob) : undefined,
        })
      }

      const selected = selectedRecipients.map((id) => recipientMap.get(id)).filter(Boolean) as RecipientOption[]
      const manual = manualEmail.trim() ? [{ name: manualEmail.trim(), email: manualEmail.trim(), type: 'manual' as const }] : []
      const whatsappContact = channel === 'whatsapp' && (deviceContact || manualPhone.trim()) ? [{ name: deviceContact?.name || manualPhone.trim(), type: 'manual' as const }] : []
      const deliveryRecipients: DeliveryRecipient[] = [...selected, ...manual, ...whatsappContact]

      if (channel === 'email') {
        const response = await fetch('/api/microsoft/send-mail', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: deliveryRecipients.map((item) => 'email' in item ? item.email : '').filter(Boolean).join(','),
            subject: `Exposés – ${generated.length} Projekt${generated.length === 1 ? '' : 'e'}`,
            body: 'Sehr geehrte Damen und Herren,\n\nanbei erhalten Sie die ausgewählten Exposés zur Prüfung.\n\nMit freundlichen Grüßen\nEMA Enterprise GmbH',
            attachments: generated.map((item) => ({ fileName: item.name, contentBytes: item.contentBytes, contentType: 'application/pdf' })),
          }),
        })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || 'E-Mail-Versand fehlgeschlagen.')
        await recordMemorandumDeliveries({ projectIds: selectedProjects, recipients: deliveryRecipients, channel: 'email', status: 'sent' })
        toast.success(`${generated.length} Exposé${generated.length === 1 ? '' : 's'} versendet.`)
        resetCenter()
        return
      }

      const files = generated.map((item) => item.file)
      if (!navigator.share || !navigator.canShare?.({ files })) throw new Error('Das Teilen mehrerer PDFs wird auf diesem Gerät nicht unterstützt.')

      setPreparedShare({ files, projectIds: [...selectedProjects], recipients: deliveryRecipients })
      toast.success('Exposés sind bereit. Tippe jetzt auf „Jetzt WhatsApp öffnen“.')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      if (isBlockedShareError(error)) {
        toast.error('Das iPhone hat den Vorgang blockiert. Bitte erneut versuchen.')
        return
      }
      toast.error(error instanceof Error ? error.message : 'Versand fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  return <>
    <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-[#07142F] px-4 py-3 text-sm font-extrabold text-white shadow-sm"><Send className="h-4 w-4" /> Mehrere Exposés versenden</button>

    {open && <div className="fixed inset-0 z-[320] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center">
      <button aria-label="Schließen" className="absolute inset-0" onClick={() => !busy && resetCenter()} />
      <section className="relative z-10 flex h-[calc(100dvh-env(safe-area-inset-top)-1rem)] w-full flex-col overflow-hidden rounded-t-[2rem] bg-[#F7F9FC] shadow-2xl sm:h-auto sm:max-h-[90dvh] sm:max-w-3xl sm:rounded-[2rem]">
        <header className="sticky top-0 z-20 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-4 pb-4 pt-[calc(env(safe-area-inset-top)+1rem)] sm:p-6">
          <div><p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#5CB800]">Versandcenter</p><h2 className="mt-1 text-2xl font-extrabold text-[#07142F]">Exposés auswählen</h2><p className="mt-1 text-sm text-slate-500">Projekte markieren und gesammelt versenden.</p></div>
          <button type="button" disabled={busy} onClick={resetCenter} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600"><X className="h-5 w-5" /></button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3"><span className="text-sm font-extrabold text-[#07142F]">{selectedProjects.length} ausgewählt</span><button type="button" onClick={() => { clearPreparedShare(); setSelectedProjects(allSelected ? [] : projects.map((item) => item.id)) }} className="text-sm font-extrabold text-[#3D9200]">{allSelected ? 'Auswahl aufheben' : 'Alle auswählen'}</button></div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">{projects.map((project) => {
            const checked = selectedProjects.includes(project.id)
            return <button key={project.id} type="button" onClick={() => toggleProject(project.id)} className={`flex items-center gap-3 rounded-2xl border p-3 text-left ${checked ? 'border-[#5CB800] bg-[#5CB800]/8' : 'border-slate-200 bg-white'}`}><span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${checked ? 'border-[#5CB800] bg-[#5CB800] text-white' : 'border-slate-300 text-transparent'}`}><Check className="h-4 w-4" /></span><span className="min-w-0"><span className="block truncate font-extrabold text-[#07142F]">{project.name}</span><span className="block truncate text-xs text-slate-500">{project.number} · {project.location} · {project.typeLabel}</span></span></button>
          })}</div>

          <div className="mt-5 grid grid-cols-2 gap-2"><button type="button" onClick={() => changeChannel('email')} className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl font-extrabold ${channel === 'email' ? 'bg-[#07142F] text-white' : 'border border-slate-200 bg-white text-[#07142F]'}`}><Mail className="h-5 w-5" /> E-Mail</button><button type="button" onClick={() => changeChannel('whatsapp')} className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl font-extrabold ${channel === 'whatsapp' ? 'bg-[#5CB800] text-white' : 'border border-slate-200 bg-white text-[#07142F]'}`}><MessageCircle className="h-5 w-5" /> WhatsApp</button></div>

          <div className="mt-5"><div className="flex items-center justify-between"><h3 className="font-extrabold text-[#07142F]">Empfänger</h3><span className="text-xs font-bold text-slate-400">Investoren & Partner</span></div><div className="mt-2 max-h-52 space-y-2 overflow-y-auto">{recipients.map((recipient) => {
            const checked = selectedRecipients.includes(recipient.id)
            return <button key={recipient.id} type="button" onClick={() => toggleRecipient(recipient.id)} className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left ${checked ? 'border-[#5CB800] bg-[#5CB800]/8' : 'border-slate-200 bg-white'}`}><span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${checked ? 'border-[#5CB800] bg-[#5CB800] text-white' : 'border-slate-300 text-transparent'}`}><Check className="h-3.5 w-3.5" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-extrabold text-[#07142F]">{recipient.name}</span><span className="block truncate text-xs text-slate-500">{recipient.type === 'investor' ? 'Investor' : 'Partner'} · {recipient.email}</span></span></button>
          })}</div>

          {channel === 'email' ? <input type="email" value={manualEmail} onChange={(event) => { clearPreparedShare(); setManualEmail(event.target.value) }} placeholder="Oder E-Mail-Adresse manuell eingeben" className="form-input mt-3" /> : <div className="mt-3 space-y-2"><button type="button" onClick={pickDeviceContact} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 font-extrabold text-[#07142F]"><Contact className="h-5 w-5 text-[#5CB800]" /> Kontakt auswählen</button>{deviceContact && <div className="rounded-xl border border-[#5CB800]/30 bg-[#5CB800]/8 px-4 py-3"><p className="text-sm font-extrabold text-[#07142F]">{deviceContact.name}</p><p className="text-xs text-slate-500">{deviceContact.phone}</p></div>}<input id="whatsapp-phone" type="tel" inputMode="tel" autoComplete="tel" value={manualPhone} onChange={(event) => { clearPreparedShare(); setManualPhone(event.target.value); setDeviceContact(null) }} placeholder="Telefonnummer optional eingeben" className="form-input" /><div className="rounded-xl bg-[#07142F]/5 px-4 py-3 text-xs leading-5 text-slate-600"><strong className="text-[#07142F]">Auf dem iPhone:</strong> Zuerst werden die PDFs vorbereitet. Danach öffnest du WhatsApp mit einem zweiten, direkten Tastendruck.</div></div>}
          </div>
        </div>

        <footer className="sticky bottom-0 z-20 border-t border-slate-200 bg-white px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3 sm:p-6"><button type="button" onClick={preparedShare && channel === 'whatsapp' ? sharePreparedFiles : dispatch} disabled={busy || !selectedProjects.length} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#5CB800] px-5 py-4 font-extrabold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-50">{busy ? <><FileText className="h-5 w-5 animate-pulse" /> {preparedShare ? 'WhatsApp wird geöffnet…' : 'Exposés werden erstellt…'}</> : <><Send className="h-5 w-5" /> {channel === 'email' ? 'Auswahl per E-Mail senden' : preparedShare ? 'Jetzt WhatsApp öffnen' : 'Exposés vorbereiten'}</>}</button></footer>
      </section>
    </div>}
  </>
}
