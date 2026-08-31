'use client'

import { useState } from 'react'
import { Eye, Save } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { jsPDF } from 'jspdf'
import { toast } from 'sonner'
import { createTemplateDocumentRecord } from '@/lib/actions/template-document.actions'
import { createClient } from '@/lib/supabase/client'

type FolderItem = { id: string; name: string }
type Props = { userId: string; folders: FolderItem[] }

function clean(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9äöüÄÖÜß_-]+/g, '_').replace(/^_+|_+$/g, '') || 'Dokument'
}

export function InvestorProfileGenerator({ userId, folders }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    company: '', contact: '', position: '', email: '', phone: '', country: '', technologies: '',
    pvFrom: '', pvTo: '', bessFrom: '', bessTo: '', stages: '', models: '', regions: '', volume: '',
    criteria: '', irr: '', comments: '', folderId: '',
  })
  const set = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }))

  const buildPdf = () => {
    if (!form.company.trim()) throw new Error('Bitte Firmenname eintragen.')
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const sections: Array<[string, string]> = [
      ['1 Unternehmensdaten / Company Information', `${form.company}\n${form.contact} · ${form.position}\n${form.email} · ${form.phone}\n${form.country}`],
      ['2 Gesuchte Technologie / Preferred Technology', form.technologies],
      ['3 Gesuchte Projektgröße / Preferred Project Size', `PV: ${form.pvFrom}–${form.pvTo} MWp\nBESS: ${form.bessFrom}–${form.bessTo} MWh`],
      ['4 Projektstatus / Preferred Project Stage', form.stages],
      ['5 Investitionsmodell / Investment Model', form.models],
      ['6 Bevorzugte Regionen / Preferred Regions', form.regions],
      ['7 Investitionsvolumen / Investment Volume', form.volume],
      ['8 Besondere Anforderungen / Additional Criteria', `${form.criteria}\nMindest-IRR / Minimum IRR: ${form.irr}%`],
      ['9 Bemerkungen / Comments', form.comments],
    ]
    let y = 20
    const header = () => {
      doc.setFillColor(11, 22, 51)
      doc.rect(0, 0, 210, 24, 'F')
      doc.setTextColor(255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(15)
      doc.text('Investoren-Suchprofil | Investor Profile', 20, 15)
      y = 34
    }
    header()
    for (const [title, value] of sections) {
      const lines = doc.splitTextToSize(value || '—', 170)
      if (y + 16 + lines.length * 5 > 280) {
        doc.addPage()
        header()
      }
      doc.setTextColor(31, 42, 68)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.text(title, 20, y)
      y += 7
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.text(lines, 20, y)
      y += lines.length * 5 + 8
    }
    const pages = doc.getNumberOfPages()
    for (let page = 1; page <= pages; page += 1) {
      doc.setPage(page)
      doc.setFontSize(7.5)
      doc.setTextColor(120)
      doc.text(`EMA Enterprise GmbH · Vertraulich / Confidential · ${page}/${pages}`, 105, 290, { align: 'center' })
    }
    return doc
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
      const blob = buildPdf().output('blob')
      const date = new Date().toISOString().slice(0, 10)
      const fileName = `Investoren-Suchprofil_${clean(form.company)}_${date}_v1.0.pdf`
      const path = `${userId}/${Date.now()}_${fileName}`
      const { error } = await supabase.storage.from('template-documents').upload(path, blob, { contentType: 'application/pdf', upsert: false })
      if (error) throw error
      const result = await createTemplateDocumentRecord({
        displayName: `Investoren-Suchprofil – ${form.company} – v1.0`, category: 'investor-profile',
        fileName, filePath: path, fileSizeBytes: blob.size, mimeType: 'application/pdf', folderId: form.folderId || null,
      })
      if (result.error) {
        await supabase.storage.from('template-documents').remove([path])
        throw new Error(result.error)
      }
      toast.success('Investoren-Suchprofil wurde gespeichert.')
      router.push('/dms')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Dokument konnte nicht gespeichert werden.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="dms-panel nda-generator-form rounded-[2rem] border border-white/10 p-5 shadow-2xl md:p-7">
      <p className="text-xs font-extrabold uppercase tracking-[.12em] text-[#8eee51]">Dokumenten-Generator</p>
      <h2 className="mt-1 text-2xl font-extrabold text-white">Investoren-Suchprofil · DE/EN</h2>
      <p className="nda-subpanel mt-5 rounded-2xl p-4 text-sm leading-6 text-slate-300">Für neue, noch nicht angelegte Investoren. Das ausgefüllte Profil kann später zum Anlegen eines Investor-Datensatzes verwendet werden.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Input value={form.company} onChange={(value) => set('company', value)} placeholder="Firmenname / Company name" wide />
        <Input value={form.contact} onChange={(value) => set('contact', value)} placeholder="Ansprechpartner / Contact person" />
        <Input value={form.position} onChange={(value) => set('position', value)} placeholder="Position / Position" />
        <Input type="email" value={form.email} onChange={(value) => set('email', value)} placeholder="E-Mail" />
        <Input type="tel" value={form.phone} onChange={(value) => set('phone', value)} placeholder="Telefon / Phone" />
        <Input value={form.country} onChange={(value) => set('country', value)} placeholder="Land / Country" />
        <Input value={form.technologies} onChange={(value) => set('technologies', value)} placeholder="Technologien / Technologies" wide />
        <Input value={form.pvFrom} onChange={(value) => set('pvFrom', value)} placeholder="PV von / PV from (MWp)" />
        <Input value={form.pvTo} onChange={(value) => set('pvTo', value)} placeholder="PV bis / PV to (MWp)" />
        <Input value={form.bessFrom} onChange={(value) => set('bessFrom', value)} placeholder="BESS von / BESS from (MWh)" />
        <Input value={form.bessTo} onChange={(value) => set('bessTo', value)} placeholder="BESS bis / BESS to (MWh)" />
        <Input value={form.stages} onChange={(value) => set('stages', value)} placeholder="Projektstatus / Project stages" wide />
        <Input value={form.models} onChange={(value) => set('models', value)} placeholder="Investitionsmodelle / Investment models" wide />
        <Input value={form.regions} onChange={(value) => set('regions', value)} placeholder="Regionen / Regions" wide />
        <Input value={form.volume} onChange={(value) => set('volume', value)} placeholder="Investitionsvolumen / Investment volume" wide />
        <Input value={form.criteria} onChange={(value) => set('criteria', value)} placeholder="Besondere Anforderungen / Additional criteria" wide />
        <Input value={form.irr} onChange={(value) => set('irr', value)} placeholder="Mindest-IRR / Minimum IRR (%)" />
      </div>
      <textarea className="form-input mt-3 min-h-28 w-full" value={form.comments} onChange={(event) => set('comments', event.target.value)} placeholder="Bemerkungen / Comments" />
      <select aria-label="Dokumentenordner" className="form-input mt-3 w-full" value={form.folderId} onChange={(event) => set('folderId', event.target.value)}>
        <option value="">Kein Ordner</option>
        {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
      </select>
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
