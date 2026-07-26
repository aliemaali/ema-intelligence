'use client'

import { useMemo, useState } from 'react'
import { addYears, format } from 'date-fns'
import { de } from 'date-fns/locale'
import { FileSignature, Eye, Save, X } from 'lucide-react'
import { jsPDF } from 'jspdf'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { createTemplateDocumentRecord } from '@/lib/actions/template-document.actions'

type FolderItem = { id: string; name: string }
type Language = 'de' | 'en'
type Duration = 1 | 2 | 3

type Props = {
  userId: string
  folders: FolderItem[]
}

type FormState = {
  language: Language
  company: string
  contactPerson: string
  street: string
  postalCode: string
  city: string
  country: string
  representedBy: string
  signatory: string
  agreementDate: string
  purpose: string
  duration: Duration
  folderId: string
  emaStreet: string
  emaPostalCode: string
  emaCity: string
  emaCountry: string
  emaRepresentedBy: string
}

const defaultPurpose = {
  de: 'Prüfung und Vorbereitung einer möglichen geschäftlichen Zusammenarbeit.',
  en: 'Evaluation and preparation of a potential business cooperation.',
}

function safeFilePart(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9äöüÄÖÜß_-]+/g, '_').replace(/^_+|_+$/g, '') || 'Vertragspartner'
}

export function NdaGenerator({ userId, folders }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const today = format(new Date(), 'yyyy-MM-dd')
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<FormState>({
    language: 'de',
    company: '',
    contactPerson: '',
    street: '',
    postalCode: '',
    city: '',
    country: 'Deutschland',
    representedBy: '',
    signatory: '',
    agreementDate: today,
    purpose: '',
    duration: 3,
    folderId: '',
    emaStreet: '',
    emaPostalCode: '',
    emaCity: '',
    emaCountry: 'Deutschland',
    emaRepresentedBy: 'Ali Ünlüer',
  })

  const expiryDate = useMemo(() => {
    const date = new Date(`${form.agreementDate}T12:00:00`)
    return Number.isNaN(date.getTime()) ? null : addYears(date, form.duration)
  }, [form.agreementDate, form.duration])

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }))
  const labels = form.language === 'de'
    ? { title: 'Geheimhaltungsvereinbarung (NDA)', save: 'PDF erstellen und speichern', preview: 'Vorschau öffnen' }
    : { title: 'Non-Disclosure Agreement (NDA)', save: 'Create and save PDF', preview: 'Open preview' }

  const validate = () => {
    if (!form.company.trim()) return 'Bitte das Unternehmen eintragen.'
    if (!form.street.trim() || !form.postalCode.trim() || !form.city.trim()) return 'Bitte die vollständige Anschrift des Vertragspartners eintragen.'
    if (!form.representedBy.trim()) return 'Bitte „Vertreten durch“ eintragen.'
    if (!form.signatory.trim()) return 'Bitte die unterschriftsberechtigte Person eintragen.'
    if (!form.emaStreet.trim() || !form.emaPostalCode.trim() || !form.emaCity.trim()) return 'Bitte die vollständige EMA-Anschrift eintragen.'
    if (!form.emaRepresentedBy.trim()) return 'Bitte die Vertretung von EMA eintragen.'
    return null
  }

  const buildPdf = () => {
    const error = validate()
    if (error) throw new Error(error)

    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const margin = 20
    const width = 170
    let y = 20
    const isDe = form.language === 'de'
    const agreementDate = new Date(`${form.agreementDate}T12:00:00`)
    const dateText = isDe ? format(agreementDate, 'dd.MM.yyyy', { locale: de }) : format(agreementDate, 'MM/dd/yyyy')
    const expiryText = expiryDate ? (isDe ? format(expiryDate, 'dd.MM.yyyy', { locale: de }) : format(expiryDate, 'MM/dd/yyyy')) : ''
    const purpose = form.purpose.trim() || defaultPurpose[form.language]

    const ensureSpace = (needed = 22) => {
      if (y + needed > 278) {
        doc.addPage()
        y = 20
      }
    }
    const heading = (text: string) => {
      ensureSpace(18)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.setTextColor(31, 42, 68)
      doc.text(text, margin, y)
      y += 8
    }
    const paragraph = (text: string) => {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9.5)
      doc.setTextColor(35, 43, 58)
      const lines = doc.splitTextToSize(text, width)
      ensureSpace(lines.length * 4.5 + 5)
      doc.text(lines, margin, y)
      y += lines.length * 4.5 + 5
    }

    doc.setFillColor(11, 22, 51)
    doc.rect(0, 0, 210, 34, 'F')
    doc.setFillColor(92, 184, 0)
    doc.rect(0, 34, 210, 2.5, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.text(isDe ? 'GEHEIMHALTUNGSVEREINBARUNG' : 'NON-DISCLOSURE AGREEMENT', margin, 18)
    doc.setFontSize(9)
    doc.text('EMA Enterprise GmbH', margin, 27)
    y = 48

    paragraph(isDe
      ? `Diese gegenseitige Geheimhaltungsvereinbarung wird am ${dateText} geschlossen zwischen:`
      : `This mutual Non-Disclosure Agreement is entered into on ${dateText} by and between:`)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('EMA Enterprise GmbH', margin, y)
    y += 5
    paragraph(`${form.emaStreet}, ${form.emaPostalCode} ${form.emaCity}, ${form.emaCountry}\n${isDe ? 'vertreten durch' : 'represented by'} ${form.emaRepresentedBy}`)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text(form.company, margin, y)
    y += 5
    paragraph(`${form.street}, ${form.postalCode} ${form.city}, ${form.country}\n${isDe ? 'vertreten durch' : 'represented by'} ${form.representedBy}${form.contactPerson ? `\n${isDe ? 'Ansprechpartner' : 'Contact person'}: ${form.contactPerson}` : ''}`)

    heading(isDe ? '1. Zweck' : '1. Purpose')
    paragraph(isDe
      ? `Die Parteien beabsichtigen, vertrauliche Informationen ausschließlich zu folgendem Zweck auszutauschen: ${purpose}`
      : `The parties intend to exchange confidential information solely for the following purpose: ${purpose}`)

    heading(isDe ? '2. Vertrauliche Informationen' : '2. Confidential Information')
    paragraph(isDe
      ? 'Als vertraulich gelten alle mündlich, schriftlich, elektronisch oder in sonstiger Form offengelegten kaufmännischen, technischen, finanziellen, rechtlichen und projektbezogenen Informationen, sofern sie als vertraulich gekennzeichnet sind oder nach den Umständen als vertraulich anzusehen sind.'
      : 'Confidential Information means all commercial, technical, financial, legal and project-related information disclosed orally, in writing, electronically or in any other form, where such information is marked confidential or should reasonably be understood to be confidential under the circumstances.')

    heading(isDe ? '3. Pflichten der Parteien' : '3. Obligations of the Parties')
    paragraph(isDe
      ? 'Die empfangende Partei wird vertrauliche Informationen sorgfältig schützen, nur für den vereinbarten Zweck verwenden und ausschließlich solchen Beschäftigten, Beratern oder verbundenen Unternehmen zugänglich machen, die diese Informationen für den Zweck benötigen und zu entsprechender Vertraulichkeit verpflichtet sind.'
      : 'The receiving party shall protect Confidential Information with due care, use it only for the agreed purpose and disclose it only to employees, advisers or affiliated companies who need it for that purpose and are bound by appropriate confidentiality obligations.')

    heading(isDe ? '4. Ausnahmen' : '4. Exclusions')
    paragraph(isDe
      ? 'Die Verpflichtungen gelten nicht für Informationen, die nachweislich bereits öffentlich bekannt waren, ohne Vertragsverletzung öffentlich bekannt werden, der empfangenden Partei rechtmäßig bereits bekannt waren, rechtmäßig von Dritten erlangt wurden oder unabhängig entwickelt wurden. Gesetzlich zwingende Offenlegungen bleiben zulässig; die andere Partei ist, soweit rechtlich möglich, vorher zu informieren.'
      : 'The obligations do not apply to information demonstrably already public, becoming public without breach, lawfully known to the receiving party, lawfully obtained from a third party or independently developed. Disclosures required by law remain permitted; where legally possible, the other party shall be informed in advance.')

    heading(isDe ? '5. Laufzeit und Vertraulichkeitsdauer' : '5. Term and Confidentiality Period')
    paragraph(isDe
      ? `Diese Vereinbarung gilt ab dem ${dateText}. Die Verpflichtung zur Vertraulichkeit besteht für ${form.duration} ${form.duration === 1 ? 'Jahr' : 'Jahre'} und endet am ${expiryText}.`
      : `This Agreement is effective from ${dateText}. The confidentiality obligations remain in force for ${form.duration} ${form.duration === 1 ? 'year' : 'years'} and expire on ${expiryText}.`)

    heading(isDe ? '6. Rückgabe und Löschung' : '6. Return and Deletion')
    paragraph(isDe
      ? 'Auf schriftliche Aufforderung sind vertrauliche Informationen und angefertigte Kopien zurückzugeben oder zu löschen, soweit keine gesetzlichen Aufbewahrungspflichten entgegenstehen.'
      : 'Upon written request, Confidential Information and copies shall be returned or deleted, unless statutory retention obligations require otherwise.')

    heading(isDe ? '7. Keine Rechteübertragung' : '7. No Transfer of Rights')
    paragraph(isDe
      ? 'Durch diese Vereinbarung werden keine Lizenzen, Eigentumsrechte oder sonstigen Nutzungsrechte übertragen. Keine Partei ist zum Abschluss eines weiteren Geschäfts verpflichtet.'
      : 'This Agreement does not transfer any licence, ownership right or other right of use. Neither party is obliged to enter into any further transaction.')

    heading(isDe ? '8. Schlussbestimmungen' : '8. Final Provisions')
    paragraph(isDe
      ? 'Änderungen und Ergänzungen bedürfen der Textform. Sollte eine Bestimmung unwirksam sein, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt. Es gilt deutsches Recht. Soweit gesetzlich zulässig, ist Gerichtsstand der Sitz der EMA Enterprise GmbH.'
      : 'Amendments must be made in text form. If any provision is invalid, the remaining provisions remain effective. German law applies. To the extent legally permitted, the venue shall be the registered office of EMA Enterprise GmbH.')

    ensureSpace(45)
    y += 5
    doc.setDrawColor(120)
    doc.line(margin, y + 18, 88, y + 18)
    doc.line(122, y + 18, 190, y + 18)
    doc.setFontSize(8.5)
    doc.setTextColor(50)
    doc.text(`EMA Enterprise GmbH\n${form.emaRepresentedBy}`, margin, y + 24)
    doc.text(`${form.company}\n${form.signatory}`, 122, y + 24)

    const pageCount = doc.getNumberOfPages()
    for (let page = 1; page <= pageCount; page += 1) {
      doc.setPage(page)
      doc.setFontSize(7.5)
      doc.setTextColor(120)
      doc.text(`EMA Enterprise GmbH · NDA · ${page}/${pageCount}`, 105, 290, { align: 'center' })
    }

    return doc
  }

  const preview = () => {
    try {
      const doc = buildPdf()
      const url = URL.createObjectURL(doc.output('blob'))
      window.open(url, '_blank', 'noopener,noreferrer')
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Vorschau konnte nicht erstellt werden.')
    }
  }

  const save = async () => {
    setSaving(true)
    try {
      const doc = buildPdf()
      const blob = doc.output('blob')
      const companyPart = safeFilePart(form.company)
      const languagePart = form.language.toUpperCase()
      const fileName = `NDA_${companyPart}_${languagePart}_${form.agreementDate}.pdf`
      const path = `${userId}/${Date.now()}_${fileName}`
      const { error: uploadError } = await supabase.storage.from('template-documents').upload(path, blob, { contentType: 'application/pdf', cacheControl: '3600', upsert: false })
      if (uploadError) throw uploadError
      const result = await createTemplateDocumentRecord({
        displayName: `NDA – ${form.company} – ${languagePart}`,
        category: 'nda',
        fileName,
        filePath: path,
        fileSizeBytes: blob.size,
        mimeType: 'application/pdf',
        folderId: form.folderId || null,
      })
      if (result.error) {
        await supabase.storage.from('template-documents').remove([path])
        throw new Error(result.error)
      }
      toast.success(form.language === 'de' ? 'NDA wurde erstellt und gespeichert.' : 'NDA was created and saved.')
      setOpen(false)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'NDA konnte nicht erstellt werden.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <section className="mb-6 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#5CB800]/12 text-[#2F8A00]"><FileSignature className="h-6 w-6" /></span>
            <div><h2 className="text-xl font-extrabold text-[#07142F]">NDA erstellen</h2><p className="mt-1 text-sm text-muted-foreground">Deutsch oder Englisch, Laufzeit 1–3 Jahre, direkt als PDF speichern.</p></div>
          </div>
          <button type="button" onClick={() => setOpen(true)} className="btn-primary shrink-0">NDA erstellen</button>
        </div>
      </section>

      {open && <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/50 p-3 md:items-center">
        <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[2rem] bg-white p-5 shadow-2xl md:p-7">
          <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-[.12em] text-[#2F8A00]">Dokumenten-Generator</p><h2 className="mt-1 text-2xl font-extrabold text-[#07142F]">{labels.title}</h2></div><button onClick={() => setOpen(false)} className="btn-icon"><X className="h-5 w-5" /></button></div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <button type="button" onClick={() => update('language', 'de')} className={`rounded-2xl border px-4 py-3 font-extrabold ${form.language === 'de' ? 'border-[#5CB800] bg-[#5CB800]/10 text-[#2F8A00]' : 'border-slate-200 text-[#07142F]'}`}>🇩🇪 Deutsch</button>
            <button type="button" onClick={() => update('language', 'en')} className={`rounded-2xl border px-4 py-3 font-extrabold ${form.language === 'en' ? 'border-[#5CB800] bg-[#5CB800]/10 text-[#2F8A00]' : 'border-slate-200 text-[#07142F]'}`}>🇬🇧 English</button>
          </div>

          <h3 className="mt-7 text-sm font-extrabold uppercase tracking-[.12em] text-slate-500">EMA Enterprise GmbH</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <input className="form-input md:col-span-2" value={form.emaStreet} onChange={(e) => update('emaStreet', e.target.value)} placeholder="Straße / Street" />
            <input className="form-input" value={form.emaPostalCode} onChange={(e) => update('emaPostalCode', e.target.value)} placeholder="PLZ / Postal code" />
            <input className="form-input" value={form.emaCity} onChange={(e) => update('emaCity', e.target.value)} placeholder="Ort / City" />
            <input className="form-input" value={form.emaCountry} onChange={(e) => update('emaCountry', e.target.value)} placeholder="Land / Country" />
            <input className="form-input" value={form.emaRepresentedBy} onChange={(e) => update('emaRepresentedBy', e.target.value)} placeholder="Vertreten durch / Represented by" />
          </div>

          <h3 className="mt-7 text-sm font-extrabold uppercase tracking-[.12em] text-slate-500">{form.language === 'de' ? 'Vertragspartner' : 'Contracting party'}</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <input className="form-input md:col-span-2" value={form.company} onChange={(e) => update('company', e.target.value)} placeholder={form.language === 'de' ? 'Unternehmen' : 'Company'} />
            <input className="form-input md:col-span-2" value={form.contactPerson} onChange={(e) => update('contactPerson', e.target.value)} placeholder={form.language === 'de' ? 'Ansprechpartner' : 'Contact person'} />
            <input className="form-input md:col-span-2" value={form.street} onChange={(e) => update('street', e.target.value)} placeholder={form.language === 'de' ? 'Straße' : 'Street'} />
            <input className="form-input" value={form.postalCode} onChange={(e) => update('postalCode', e.target.value)} placeholder={form.language === 'de' ? 'PLZ' : 'Postal code'} />
            <input className="form-input" value={form.city} onChange={(e) => update('city', e.target.value)} placeholder={form.language === 'de' ? 'Ort' : 'City'} />
            <input className="form-input" value={form.country} onChange={(e) => update('country', e.target.value)} placeholder={form.language === 'de' ? 'Land' : 'Country'} />
            <input className="form-input" value={form.representedBy} onChange={(e) => update('representedBy', e.target.value)} placeholder={form.language === 'de' ? 'Vertreten durch' : 'Represented by'} />
            <input className="form-input md:col-span-2" value={form.signatory} onChange={(e) => update('signatory', e.target.value)} placeholder={form.language === 'de' ? 'Unterschriftsberechtigte Person' : 'Authorised signatory'} />
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="text-sm font-bold text-[#07142F]">{form.language === 'de' ? 'Datum' : 'Date'}<input type="date" className="form-input mt-1 w-full" value={form.agreementDate} onChange={(e) => update('agreementDate', e.target.value)} /></label>
            <label className="text-sm font-bold text-[#07142F]">{form.language === 'de' ? 'Dauer' : 'Duration'}<select className="form-input mt-1 w-full" value={form.duration} onChange={(e) => update('duration', Number(e.target.value) as Duration)}><option value={1}>1 {form.language === 'de' ? 'Jahr' : 'year'}</option><option value={2}>2 {form.language === 'de' ? 'Jahre' : 'years'}</option><option value={3}>3 {form.language === 'de' ? 'Jahre' : 'years'}</option></select></label>
          </div>
          {expiryDate && <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">{form.language === 'de' ? 'Ablaufdatum' : 'Expiry date'}: {form.language === 'de' ? format(expiryDate, 'dd.MM.yyyy', { locale: de }) : format(expiryDate, 'MM/dd/yyyy')}</p>}

          <textarea className="form-input mt-3 min-h-24 w-full" value={form.purpose} onChange={(e) => update('purpose', e.target.value)} placeholder={form.language === 'de' ? 'Zweck / Projektbezug (optional)' : 'Purpose / Project reference (optional)'} />
          <select className="form-input mt-3 w-full" value={form.folderId} onChange={(e) => update('folderId', e.target.value)}><option value="">{form.language === 'de' ? 'Kein Ordner' : 'No folder'}</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select>

          <p className="mt-4 text-xs leading-5 text-muted-foreground">Hinweis: Diese Vorlage ersetzt keine individuelle Rechtsberatung. Vor dem produktiven Einsatz sollte der Vertrag rechtlich geprüft werden.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2"><button type="button" onClick={preview} className="btn-secondary inline-flex items-center justify-center gap-2"><Eye className="h-4 w-4" />{labels.preview}</button><button type="button" onClick={save} disabled={saving} className="btn-primary inline-flex items-center justify-center gap-2"><Save className="h-4 w-4" />{saving ? 'Wird gespeichert…' : labels.save}</button></div>
        </div>
      </div>}
    </>
  )
}
