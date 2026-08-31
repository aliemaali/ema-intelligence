'use client'

import { useMemo, useState } from 'react'
import { Eye, Save } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createTemplateDocumentRecord } from '@/lib/actions/template-document.actions'
import { buildBilingualCommissionPdf } from '@/lib/pdf/legalDocuments'
import { createClient } from '@/lib/supabase/client'
import { documentInvestorLabel, partialInvestorAddress, type DocumentInvestor } from '@/lib/templates/documentTypes'

type FolderItem = { id: string; name: string }
type Props = { userId: string; folders: FolderItem[]; investors: DocumentInvestor[] }

function clean(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9äöüÄÖÜß_-]+/g, '_').replace(/^_+|_+$/g, '') || 'Dokument'
}

function money(value: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value || 0)
}

export function CommissionGenerator({ userId, folders, investors }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [selectedInvestorId, setSelectedInvestorId] = useState('')
  const [form, setForm] = useState({
    company: '', contact: '', email: '', phone: '', address: '', project: '', projectNumber: '',
    date: new Date().toISOString().slice(0, 10), model: 'flat', rate: '', size: '', purchasePrice: '',
    paymentTerm: 'closing', folderId: '',
  })

  const set = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }))
  const total = useMemo(() => {
    const rate = Number(form.rate.replace(',', '.')) || 0
    const size = Number(form.size.replace(',', '.')) || 0
    const price = Number(form.purchasePrice.replace(',', '.')) || 0
    if (form.model === 'flat') return rate
    if (form.model === 'percent') return price * rate / 100
    return rate * size
  }, [form])

  const selectInvestor = (investorId: string) => {
    setSelectedInvestorId(investorId)
    const investor = investors.find((item) => item.id === investorId)
    if (!investor) return
    setForm((current) => ({
      ...current,
      company: investor.company,
      contact: investor.contactPerson,
      email: investor.email,
      phone: investor.phone,
      address: partialInvestorAddress(investor),
    }))
  }

  const validate = () => {
    if (!form.company.trim()) return 'Bitte Unternehmen eintragen.'
    if (!form.address.trim()) return 'Bitte die vollständige Anschrift eintragen.'
    if (!form.project.trim()) return 'Bitte das Projekt eintragen.'
    if ((Number(form.rate.replace(',', '.')) || 0) <= 0) return 'Bitte eine gültige Vergütung eintragen.'
    if ((form.model === 'pv' || form.model === 'bess') && (Number(form.size.replace(',', '.')) || 0) <= 0) return 'Bitte eine gültige Projektgröße eintragen.'
    if (form.model === 'percent' && (Number(form.purchasePrice.replace(',', '.')) || 0) <= 0) return 'Bitte einen gültigen Kaufpreis eintragen.'
    return null
  }

  const buildPdf = () => {
    const error = validate()
    if (error) throw new Error(error)
    return buildBilingualCommissionPdf({ ...form, total })
  }

  const preview = () => {
    try {
      const blob = buildPdf().output('blob')
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener,noreferrer')
      window.setTimeout(() => URL.revokeObjectURL(url), 120_000)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Vorschau konnte nicht erstellt werden.')
    }
  }

  const save = async () => {
    setSaving(true)
    try {
      const doc = buildPdf()
      const blob = doc.output('blob')
      const fileName = `Provisionsvereinbarung_${clean(form.company)}_DE-EN_${form.date}_v1.0.pdf`
      const path = `${userId}/${Date.now()}_${fileName}`
      const { error } = await supabase.storage.from('template-documents').upload(path, blob, { contentType: 'application/pdf', upsert: false })
      if (error) throw error
      const result = await createTemplateDocumentRecord({
        displayName: `Provisionsvereinbarung – ${form.company} – DE/EN – v1.0`,
        category: 'commission', fileName, filePath: path, fileSizeBytes: blob.size, mimeType: 'application/pdf',
        folderId: form.folderId || null, investorId: selectedInvestorId || null,
      })
      if (result.error) {
        await supabase.storage.from('template-documents').remove([path])
        throw new Error(result.error)
      }
      toast.success('Zweisprachige Provisionsvereinbarung wurde gespeichert und zugeordnet.')
      router.push('/dms')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Dokument konnte nicht gespeichert werden.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="dms-panel nda-generator-form rounded-[2rem] border border-white/10 p-5 shadow-2xl md:p-7">
      <div>
        <p className="text-xs font-extrabold uppercase tracking-[.12em] text-[#8eee51]">Dokumenten-Generator</p>
        <h2 className="mt-1 text-2xl font-extrabold text-white">Provisionsvereinbarung · DE/EN</h2>
      </div>

      <div className="nda-subpanel mt-5 rounded-2xl p-4">
        <label htmlFor="commission-investor" className="text-sm font-extrabold text-white">Investor aus Liste auswählen</label>
        <select id="commission-investor" className="form-input mt-2 w-full" value={selectedInvestorId} onChange={(event) => selectInvestor(event.target.value)}>
          <option value="">Manuell eingeben / Manual entry</option>
          {investors.map((investor) => <option key={investor.id} value={investor.id}>{documentInvestorLabel(investor)}</option>)}
        </select>
        <p className="mt-2 text-xs leading-5 text-slate-300">Vorhandene Daten werden übernommen und bleiben editierbar. Die PDF wird automatisch dem ausgewählten Investor zugeordnet.</p>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2">
        <Input value={form.company} onChange={(value) => set('company', value)} placeholder="Unternehmen / Company" wide />
        <Input value={form.contact} onChange={(value) => set('contact', value)} placeholder="Ansprechpartner / Contact person" />
        <Input type="email" value={form.email} onChange={(value) => set('email', value)} placeholder="E-Mail" />
        <Input type="tel" value={form.phone} onChange={(value) => set('phone', value)} placeholder="Telefon / Phone" />
        <Input value={form.address} onChange={(value) => set('address', value)} placeholder="Vollständige Anschrift / Full address" wide />
        <Input value={form.project} onChange={(value) => set('project', value)} placeholder="Projekt / Project" />
        <Input value={form.projectNumber} onChange={(value) => set('projectNumber', value)} placeholder="Projektnummer / Project number" />
        <Input type="date" value={form.date} onChange={(value) => set('date', value)} placeholder="Datum" />
      </div>

      <select aria-label="Provisionsmodell" className="form-input mt-3 w-full" value={form.model} onChange={(event) => set('model', event.target.value)}>
        <option value="flat">Pauschalbetrag / Flat fee</option>
        <option value="pv">€/kWp (PV)</option>
        <option value="bess">€/MWh (BESS)</option>
        <option value="percent">Prozent / Percentage (%)</option>
      </select>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Input value={form.rate} onChange={(value) => set('rate', value)} placeholder={form.model === 'flat' ? 'Pauschalbetrag (€)' : form.model === 'percent' ? 'Provisionssatz (%)' : form.model === 'pv' ? 'Vergütung (€/kWp)' : 'Vergütung (€/MWh)'} />
        {form.model === 'percent'
          ? <Input value={form.purchasePrice} onChange={(value) => set('purchasePrice', value)} placeholder="Kaufpreis / Purchase price (€)" />
          : form.model !== 'flat'
            ? <Input value={form.size} onChange={(value) => set('size', value)} placeholder={form.model === 'pv' ? 'Anlagengröße / Plant size (kWp)' : 'Speichergröße / Storage size (MWh)'} />
            : null}
      </div>
      <p className="nda-subpanel mt-3 rounded-xl px-4 py-3 font-extrabold text-white">Gesamtprovision / Total commission: {money(total)}</p>
      <select aria-label="Zahlungsbedingung" className="form-input mt-3 w-full" value={form.paymentTerm} onChange={(event) => set('paymentTerm', event.target.value)}>
        <option value="signature">Nach Vertragsunterzeichnung / Upon signing</option>
        <option value="receipt">Nach Zahlungseingang / Upon receipt of payment</option>
        <option value="closing">Nach Closing / Upon closing</option>
        <option value="grid_connection">Nach Netzanschluss / Upon grid connection</option>
        <option value="individual">Individuell / Individual</option>
      </select>
      <FolderSelect value={form.folderId} folders={folders} onChange={(value) => set('folderId', value)} />
      <p className="mt-4 text-xs leading-5 text-slate-400">Hinweis: Diese Vorlage ersetzt keine individuelle Rechtsberatung. Vor dem produktiven Einsatz sollte die Vereinbarung rechtlich geprüft werden.</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={preview} disabled={saving} className="btn-secondary inline-flex items-center justify-center gap-2">
          <Eye className="h-4 w-4" /> Vorschau
        </button>
        <button type="button" onClick={save} disabled={saving} className="btn-primary inline-flex items-center justify-center gap-2">
          <Save className="h-4 w-4" /> {saving ? 'Wird gespeichert…' : 'Erstellen & speichern'}
        </button>
      </div>
    </section>
  )
}

function Input({ value, onChange, placeholder, type = 'text', wide = false }: { value: string; onChange: (value: string) => void; placeholder: string; type?: string; wide?: boolean }) {
  return <input type={type} className={`form-input ${wide ? 'md:col-span-2' : ''}`} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
}

function FolderSelect({ value, folders, onChange }: { value: string; folders: FolderItem[]; onChange: (value: string) => void }) {
  return (
    <select aria-label="Dokumentenordner" className="form-input mt-3 w-full" value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Kein Ordner</option>
      {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
    </select>
  )
}
