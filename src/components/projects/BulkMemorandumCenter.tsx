'use client'

import { useMemo, useState } from 'react'
import { Check, Contact, FileText, Mail, MessageCircle, Send, X } from 'lucide-react'
import { toast } from 'sonner'
import { generateMemorandumPdf } from '@/lib/pdf/memorandumPdf'
import { getBulkMemorandumData, recordMemorandumDeliveries } from '@/lib/actions/bulk-memorandum.actions'

interface ProjectOption {
  id: string
  name: string
  number: string
  location: string
  typeLabel: string
}

interface RecipientOption {
  id: string
  name: string
  email: string
  type: 'investor' | 'partner'
}

interface DeviceContact {
  name: string
  phone: string
}

interface BulkMemorandumCenterProps {
  projects: ProjectOption[]
  recipients: RecipientOption[]
}

function safeFileName(value: string) {
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

export function BulkMemorandumCenter({ projects, recipients }: BulkMemorandumCenterProps) {
  const [open, setOpen] = useState(false)
  const [selectedProjects, setSelectedProjects] = useState<string[]>([])
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([])
  const [manualEmail, setManualEmail] = useState('')
  const [deviceContact, setDeviceContact] = useState<DeviceContact | null>(null)
  const [manualPhone, setManualPhone] = useState('')
  const [channel, setChannel] = useState<'email' | 'whatsapp'>('email')
  const [busy, setBusy] = useState(false)

  const recipientMap = useMemo(() => new Map(recipients.map((item) => [item.id, item])), [recipients])
  const allSelected = projects.length > 0 && selectedProjects.length === projects.length

  function toggleProject(id: string) {
    setSelectedProjects((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  function toggleRecipient(id: string) {
    setSelectedRecipients((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  async function pickDeviceContact() {
    type ContactPickerNavigator = Navigator & {
      contacts?: {
        select: (properties: Array<'name' | 'tel'>, options: { multiple: boolean }) => Promise<Array<{ name?: string[]; tel?: string[] }>>
      }
    }

    const contactNavigator = navigator as ContactPickerNavigator
    if (!contactNavigator.contacts?.select) {
      toast.info('Apple erlaubt EMA auf dem iPhone keinen direkten Zugriff auf das Adressbuch. Bitte Telefonnummer eingeben oder den Kontakt anschließend in WhatsApp auswählen.')
      window.setTimeout(() => document.getElementById('whatsapp-phone')?.focus(), 50)
      return
    }

    try {
      const selected = await contactNavigator.contacts.select(['name', 'tel'], { multiple: false })
      const contact = selected[0]
      const phone = contact?.tel?.[0]?.trim() || ''
      if (!phone) return toast.error('Der ausgewählte Kontakt enthält keine Telefonnummer.')
      const name = contact?.name?.[0]?.trim() || phone
      setDeviceContact({ name, phone })
      setManualPhone(phone)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      toast.error('Der Kontakt konnte nicht übernommen werden.')
    }
  }

  async function dispatch() {
    if (!selectedProjects.length) return toast.error('Bitte mindestens ein Projekt auswählen.')
    if (channel === 'email' && !selectedRecipients.length && !manualEmail.trim()) return toast.error('Bitte mindestens einen Empfänger auswählen.')

    setBusy(true)
    try {
      const result = await getBulkMemorandumData(selectedProjects)
      if (!result.success || !result.data.length) throw new Error('Keine Memoranden konnten erstellt werden.')

      const generated = [] as Array<{ projectId: string; name: string; file: File; contentBytes: string }>
      for (const item of result.data) {
        const blob = await generateMemorandumPdf(item.data)
        const name = `EMA_Investment_Memorandum_${safeFileName(item.data.projectName)}.pdf`
        generated.push({ projectId: item.projectId, name, file: new File([blob], name, { type: 'application/pdf' }), contentBytes: await blobToBase64(blob) })
      }

      const selected = selectedRecipients.map((id) => recipientMap.get(id)).filter(Boolean) as RecipientOption[]
      const manual = manualEmail.trim() ? [{ name: manualEmail.trim(), email: manualEmail.trim(), type: 'manual' as const }] : []
      const whatsappContact = channel === 'whatsapp' && (deviceContact || manualPhone.trim())
        ? [{ name: deviceContact?.name || manualPhone.trim(), type: 'manual' as const }]
        : []
      const deliveryRecipients = [...selected, ...manual, ...whatsappContact]

      if (channel === 'email') {
        const response = await fetch('/api/microsoft/send-mail', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: deliveryRecipients.map((item) => 'email' in item ? item.email : '').filter(Boolean).join(','),
            subject: `Investment Memoranden – ${generated.length} Projekt${generated.length === 1 ? '' : 'e'}`,
            body: 'Sehr geehrte Damen und Herren,\n\nanbei erhalten Sie die ausgewählten Investment Memoranden zur Prüfung.\n\nMit freundlichen Grüßen\nEMA Enterprise GmbH',
            attachments: generated.map((item) => ({ fileName: item.name, contentBytes: item.contentBytes, contentType: 'application/pdf' })),
          }),
        })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || 'E-Mail-Versand fehlgeschlagen.')
        await recordMemorandumDeliveries({ projectIds: selectedProjects, recipients: deliveryRecipients, channel: 'email', status: 'sent' })
        toast.success(`${generated.length} Memorandum${generated.length === 1 ? '' : 'en'} versendet.`)
      } else {
        if (!navigator.share || !navigator.canShare?.({ files: generated.map((item) => item.file) })) {
          throw new Error('Mehrfach-Teilen wird auf diesem Gerät nicht unterstützt.')
        }
        await navigator.share({
          title: 'EMA Investment Memoranden',
          text: 'Anbei erhalten Sie die ausgewählten Investment Memoranden zur Prüfung.',
          files: generated.map((item) => item.file),
        })
        await recordMemorandumDeliveries({ projectIds: selectedProjects, recipients: deliveryRecipients, channel: 'whatsapp', status: 'shared' })
        toast.success('WhatsApp-Teilen wurde abgeschlossen.')
      }

      setOpen(false)
      setSelectedProjects([])
      setSelectedRecipients([])
      setManualEmail('')
      setDeviceContact(null)
      setManualPhone('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Versand fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-[#07142F] px-4 py-3 text-sm font-extrabold text-white shadow-sm">
        <Send className="h-4 w-4" /> Mehrere Memoranden versenden
      </button>

      {open && (
        <div className="fixed inset-0 z-[320] flex items-end justify-center sm:items-center">
          <button aria-label="Schließen" className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !busy && setOpen(false)} />
          <section className="relative z-10 mb-[calc(env(safe-area-inset-bottom)+5.5rem)] max-h-[82dvh] w-full overflow-y-auto rounded-t-[2rem] bg-[#F7F9FC] p-4 shadow-2xl sm:mb-0 sm:max-w-3xl sm:rounded-[2rem] sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#5CB800]">Versandcenter</p><h2 className="mt-1 text-2xl font-extrabold text-[#07142F]">Memoranden auswählen</h2><p className="mt-1 text-sm text-slate-500">Mehrere Projekte markieren und gesammelt per E-Mail oder WhatsApp teilen.</p></div>
              <button type="button" disabled={busy} onClick={() => setOpen(false)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm"><X className="h-5 w-5" /></button>
            </div>

            <div className="mt-5 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <span className="text-sm font-extrabold text-[#07142F]">{selectedProjects.length} ausgewählt</span>
              <button type="button" onClick={() => setSelectedProjects(allSelected ? [] : projects.map((item) => item.id))} className="text-sm font-extrabold text-[#3D9200]">{allSelected ? 'Auswahl aufheben' : 'Alle auswählen'}</button>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {projects.map((project) => {
                const checked = selectedProjects.includes(project.id)
                return <button key={project.id} type="button" onClick={() => toggleProject(project.id)} className={`flex items-center gap-3 rounded-2xl border p-3 text-left ${checked ? 'border-[#5CB800] bg-[#5CB800]/8' : 'border-slate-200 bg-white'}`}>
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border ${checked ? 'border-[#5CB800] bg-[#5CB800] text-white' : 'border-slate-300 text-transparent'}`}><Check className="h-4 w-4" /></span>
                  <span className="min-w-0"><span className="block truncate font-extrabold text-[#07142F]">{project.name}</span><span className="block truncate text-xs text-slate-500">{project.number} · {project.location} · {project.typeLabel}</span></span>
                </button>
              })}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setChannel('email')} className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl font-extrabold ${channel === 'email' ? 'bg-[#07142F] text-white' : 'border border-slate-200 bg-white text-[#07142F]'}`}><Mail className="h-5 w-5" /> E-Mail</button>
              <button type="button" onClick={() => setChannel('whatsapp')} className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl font-extrabold ${channel === 'whatsapp' ? 'bg-[#5CB800] text-white' : 'border border-slate-200 bg-white text-[#07142F]'}`}><MessageCircle className="h-5 w-5" /> WhatsApp</button>
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between"><h3 className="font-extrabold text-[#07142F]">Empfänger</h3><span className="text-xs font-bold text-slate-400">Investoren & Partner</span></div>
              <div className="mt-2 max-h-48 space-y-2 overflow-y-auto">
                {recipients.map((recipient) => {
                  const checked = selectedRecipients.includes(recipient.id)
                  return <button key={recipient.id} type="button" onClick={() => toggleRecipient(recipient.id)} className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left ${checked ? 'border-[#5CB800] bg-[#5CB800]/8' : 'border-slate-200 bg-white'}`}>
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${checked ? 'border-[#5CB800] bg-[#5CB800] text-white' : 'border-slate-300 text-transparent'}`}><Check className="h-3.5 w-3.5" /></span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-extrabold text-[#07142F]">{recipient.name}</span><span className="block truncate text-xs text-slate-500">{recipient.type === 'investor' ? 'Investor' : 'Partner'} · {recipient.email}</span></span>
                  </button>
                })}
              </div>

              {channel === 'email' ? (
                <input type="email" value={manualEmail} onChange={(event) => setManualEmail(event.target.value)} placeholder="Oder E-Mail-Adresse manuell eingeben" className="form-input mt-3" />
              ) : (
                <div className="mt-3 space-y-2">
                  <button type="button" onClick={pickDeviceContact} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 font-extrabold text-[#07142F]">
                    <Contact className="h-5 w-5 text-[#5CB800]" /> Kontakt aus Adressbuch wählen
                  </button>
                  {deviceContact && <div className="rounded-xl border border-[#5CB800]/30 bg-[#5CB800]/8 px-4 py-3"><p className="text-sm font-extrabold text-[#07142F]">{deviceContact.name}</p><p className="text-xs text-slate-500">{deviceContact.phone}</p></div>}
                  <input id="whatsapp-phone" type="tel" inputMode="tel" autoComplete="tel" value={manualPhone} onChange={(event) => { setManualPhone(event.target.value); setDeviceContact(null) }} placeholder="Telefonnummer manuell eingeben" className="form-input" />
                  <p className="text-xs leading-5 text-slate-500">Auf unterstützten Geräten öffnet EMA die Kontaktauswahl. Auf dem iPhone wird der tatsächliche WhatsApp-Kontakt weiterhin im Teilen-Menü ausgewählt.</p>
                </div>
              )}
            </div>

            <button type="button" onClick={dispatch} disabled={busy || !selectedProjects.length} className="mt-5 flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[#5CB800] px-5 py-4 font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50">
              {busy ? <><FileText className="h-5 w-5 animate-pulse" /> Memoranden werden erstellt…</> : <><Send className="h-5 w-5" /> {channel === 'email' ? 'Auswahl per E-Mail senden' : 'Über WhatsApp teilen'}</>}
            </button>
          </section>
        </div>
      )}
    </>
  )
}
