'use client'

import { useEffect, useMemo, useState } from 'react'
import { addYears, format } from 'date-fns'
import { de } from 'date-fns/locale'
import { Eye, FileSignature, Save, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createTemplateDocumentRecord } from '@/lib/actions/template-document.actions'
import { buildBilingualNdaPdf, DEFAULT_NDA_PURPOSE, safeLegalDocumentFilePart, type LegalDocumentAssets } from '@/lib/pdf/legalDocuments'
import { createClient } from '@/lib/supabase/client'
import { documentInvestorLabel, type DocumentInvestor } from '@/lib/templates/documentTypes'

type FolderItem = { id: string; name: string }
type Duration = 1 | 2 | 3

type Props = { userId: string; folders: FolderItem[]; investors: DocumentInvestor[] }

type FormState = {
  company: string
  contactPerson: string
  email: string
  phone: string
  street: string
  postalCode: string
  city: string
  country: string
  representedBy: string
  signatory: string
  agreementDate: string
  purposeDe: string
  purposeEn: string
  duration: Duration
  folderId: string
}

async function fetchDataUrl(path: string) {
  const response = await fetch(path)
  if (!response.ok) throw new Error('EMA-Design konnte nicht geladen werden.')
  const blob = await response.blob()
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('EMA-Design konnte nicht gelesen werden.'))
    reader.readAsDataURL(blob)
  })
}

async function fetchFontBase64(path: string) {
  const response = await fetch(path)
  if (!response.ok) throw new Error('PDF-Schrift konnte nicht geladen werden.')
  const bytes = new Uint8Array(await response.arrayBuffer())
  let binary = ''
  const chunkSize = 32_768
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}

export function NdaGenerator({ userId, folders, investors }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [assets, setAssets] = useState<LegalDocumentAssets | null>(null)
  const [assetError, setAssetError] = useState<string | null>(null)
  const [selectedInvestorId, setSelectedInvestorId] = useState('')
  const [form, setForm] = useState<FormState>({
    company: '', contactPerson: '', email: '', phone: '', street: '', postalCode: '', city: '', country: 'Deutschland',
    representedBy: '', signatory: '', agreementDate: format(new Date(), 'yyyy-MM-dd'), purposeDe: DEFAULT_NDA_PURPOSE.de, purposeEn: DEFAULT_NDA_PURPOSE.en, duration: 3, folderId: '',
  })

  useEffect(() => {
    let active = true
    Promise.all([
      fetchDataUrl('/brand/ema-logo.png'),
      fetchFontBase64('/fonts/inter/inter-latin-ext-400.ttf'),
      fetchFontBase64('/fonts/inter/inter-latin-ext-600.ttf'),
      fetchFontBase64('/fonts/inter/inter-latin-ext-700.ttf'),
    ]).then(([logoDataUrl, regularFontBase64, semiBoldFontBase64, boldFontBase64]) => {
      if (!active) return
      setAssets({ logoDataUrl, regularFontBase64, semiBoldFontBase64, boldFontBase64 })
    }).catch((error) => {
      if (!active) return
      setAssetError(error instanceof Error ? error.message : 'PDF-Design konnte nicht vorbereitet werden.')
    })
    return () => { active = false }
  }, [])

  const expiryDate = useMemo(() => {
    const date = new Date(`${form.agreementDate}T12:00:00`)
    return Number.isNaN(date.getTime()) ? null : addYears(date, form.duration)
  }, [form.agreementDate, form.duration])

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }))

  const selectInvestor = (investorId: string) => {
    setSelectedInvestorId(investorId)
    const investor = investors.find((item) => item.id === investorId)
    if (!investor) return
    setForm((current) => ({
      ...current,
      company: investor.company,
      contactPerson: investor.contactPerson,
      email: investor.email,
      phone: investor.phone,
      street: investor.street,
      postalCode: investor.postalCode,
      city: investor.city,
      country: investor.country || current.country,
    }))
  }

  const validate = () => {
    if (!form.company.trim()) return 'Bitte das Unternehmen eintragen.'
    if (!form.street.trim() || !form.postalCode.trim() || !form.city.trim()) return 'Bitte die vollständige Anschrift des Vertragspartners eintragen.'
    return null
  }

  const buildPdf = () => {
    const error = validate()
    if (error) throw new Error(error)
    if (!assets) throw new Error(assetError ?? 'PDF wird noch vorbereitet. Bitte kurz warten.')
    return buildBilingualNdaPdf(form, assets)
  }

  const preview = () => { try { const doc = buildPdf(); const url = URL.createObjectURL(doc.output('blob')); window.open(url, '_blank', 'noopener,noreferrer'); window.setTimeout(() => URL.revokeObjectURL(url), 60_000) } catch (error) { toast.error(error instanceof Error ? error.message : 'Vorschau konnte nicht erstellt werden.') } }
  const save = async () => { setSaving(true); try { const doc = buildPdf(); const blob = doc.output('blob'); const fileName = `NDA_${safeLegalDocumentFilePart(form.company)}_DE-EN_${form.agreementDate}.pdf`; const path = `${userId}/${Date.now()}_${fileName}`; const { error } = await supabase.storage.from('template-documents').upload(path, blob, { contentType: 'application/pdf', cacheControl: '3600', upsert: false }); if (error) throw error; const result = await createTemplateDocumentRecord({ displayName: `NDA – ${form.company} – DE/EN`, category: 'nda', fileName, filePath: path, fileSizeBytes: blob.size, mimeType: 'application/pdf', folderId: form.folderId || null, investorId: selectedInvestorId || null }); if (result.error) { await supabase.storage.from('template-documents').remove([path]); throw new Error(result.error) } toast.success('Zweisprachige NDA wurde erstellt, gespeichert und zugeordnet.'); setOpen(false); router.refresh() } catch (error) { toast.error(error instanceof Error ? error.message : 'NDA konnte nicht erstellt werden.') } finally { setSaving(false) } }

  return <>
    <section className="mb-6 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm md:p-7"><div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div className="flex items-center gap-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#5CB800]/12 text-[#2F8A00]"><FileSignature className="h-6 w-6" /></span><div><h2 className="text-xl font-extrabold text-[#07142F]">NDA erstellen</h2><p className="mt-1 text-sm text-muted-foreground">Investor auswählen und eine gemeinsame PDF auf Deutsch und Englisch erstellen.</p></div></div><button type="button" onClick={() => setOpen(true)} className="btn-primary shrink-0">NDA erstellen</button></div></section>
    {open && <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/50 p-3 md:items-center"><div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[2rem] bg-white p-5 shadow-2xl md:p-7"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-[.12em] text-[#2F8A00]">Dokumenten-Generator</p><h2 className="mt-1 text-2xl font-extrabold text-[#07142F]">NDA · Deutsch &amp; English</h2></div><button onClick={() => setOpen(false)} className="btn-icon"><X className="h-5 w-5" /></button></div>
      <div className="mt-5 rounded-2xl border border-[#5CB800]/30 bg-[#5CB800]/8 p-4"><label className="text-sm font-extrabold text-[#07142F]">Investor aus Liste auswählen<select className="form-input mt-2 w-full bg-white" value={selectedInvestorId} onChange={(e) => selectInvestor(e.target.value)}><option value="">Manuell eingeben / Manual entry</option>{investors.map((investor) => <option key={investor.id} value={investor.id}>{documentInvestorLabel(investor)}</option>)}</select></label><p className="mt-2 text-xs leading-5 text-slate-600">Firma, Ansprechpartner und vollständige Geschäftsanschrift werden übernommen. Vertretungs- und Unterschriftsangaben sind optional und können später vom Vertragspartner ergänzt werden. Das gespeicherte Dokument wird automatisch dem Investor zugeordnet.</p></div>
      <div className="mt-5 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600">Absender / Sender: EMA Enterprise GmbH</div>
      <h3 className="mt-7 text-sm font-extrabold uppercase tracking-[.12em] text-slate-500">Vertragspartner / Contracting party</h3>
      <div className="mt-3 grid gap-3 md:grid-cols-2"><input className="form-input md:col-span-2" value={form.company} onChange={(e) => update('company', e.target.value)} placeholder="Unternehmen / Company" /><input className="form-input md:col-span-2" value={form.contactPerson} onChange={(e) => update('contactPerson', e.target.value)} placeholder="Ansprechpartner / Contact person" /><input className="form-input" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="E-Mail" /><input className="form-input" type="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="Telefon / Phone" /><input className="form-input md:col-span-2" value={form.street} onChange={(e) => update('street', e.target.value)} placeholder="Straße / Street" /><input className="form-input" value={form.postalCode} onChange={(e) => update('postalCode', e.target.value)} placeholder="PLZ / Postal code" /><input className="form-input" value={form.city} onChange={(e) => update('city', e.target.value)} placeholder="Ort / City" /><input className="form-input" value={form.country} onChange={(e) => update('country', e.target.value)} placeholder="Land / Country" /><input className="form-input" value={form.representedBy} onChange={(e) => update('representedBy', e.target.value)} placeholder="Vertreten durch / Represented by (optional)" /><input className="form-input md:col-span-2" value={form.signatory} onChange={(e) => update('signatory', e.target.value)} placeholder="Unterschriftsberechtigte Person / Authorised signatory (optional)" /></div>
      <p className="mt-2 text-xs leading-5 text-slate-500">Wenn kein Name vorliegt, bleibt „Vertreten durch“ im PDF vollständig weg. Im Unterschriftsbereich erscheinen stattdessen beschriftete Felder für die unterschriftsberechtigte Person sowie Name und Funktion.</p>
      <div className="mt-3 grid gap-3 md:grid-cols-2"><label className="text-sm font-bold text-[#07142F]">Datum / Date<input type="date" className="form-input mt-1 w-full" value={form.agreementDate} onChange={(e) => update('agreementDate', e.target.value)} /></label><label className="text-sm font-bold text-[#07142F]">Dauer / Duration<select className="form-input mt-1 w-full" value={form.duration} onChange={(e) => update('duration', Number(e.target.value) as Duration)}><option value={1}>1 Jahr / year</option><option value={2}>2 Jahre / years</option><option value={3}>3 Jahre / years</option></select></label></div>
      {expiryDate && <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">Ablaufdatum / Expiry date: {format(expiryDate, 'dd.MM.yyyy', { locale: de })}</p>}
      <div className="mt-3 grid gap-3 md:grid-cols-2"><textarea className="form-input min-h-24 w-full" value={form.purposeDe} onChange={(e) => update('purposeDe', e.target.value)} placeholder="Zweck / Projektbezug auf Deutsch (optional)" /><textarea className="form-input min-h-24 w-full" value={form.purposeEn} onChange={(e) => update('purposeEn', e.target.value)} placeholder="Purpose / project reference in English (optional)" /></div>
      <select className="form-input mt-3 w-full" value={form.folderId} onChange={(e) => update('folderId', e.target.value)}><option value="">Kein Ordner / No folder</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select>
      <p className="mt-4 text-xs leading-5 text-muted-foreground">Hinweis: Diese Vorlage ersetzt keine individuelle Rechtsberatung. Vor dem produktiven Einsatz sollte der Vertrag rechtlich geprüft werden.</p>
      {assetError && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700">{assetError}</p>}
      <div className="mt-6 grid gap-3 sm:grid-cols-2"><button type="button" onClick={preview} disabled={!assets} className="btn-secondary inline-flex items-center justify-center gap-2"><Eye className="h-4 w-4" />{assets ? 'Vorschau öffnen' : 'PDF wird vorbereitet…'}</button><button type="button" onClick={save} disabled={saving || !assets} className="btn-primary inline-flex items-center justify-center gap-2"><Save className="h-4 w-4" />{saving ? 'Wird gespeichert…' : 'DE/EN-PDF erstellen und speichern'}</button></div>
    </div></div>}
  </>
}
