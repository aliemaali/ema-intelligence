'use client'

import { useMemo, useState } from 'react'
import { FileText, Save, X } from 'lucide-react'
import { jsPDF } from 'jspdf'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { createTemplateDocumentRecord } from '@/lib/actions/template-document.actions'
import { ProjectChecklistGenerator } from '@/components/templates/ProjectChecklistGenerator'

type FolderItem = { id: string; name: string }
type Props = { userId: string; folders: FolderItem[] }
type Language = 'de' | 'en'

type GeneratorKind = 'commission' | 'investor-profile' | 'project-checklist'

function clean(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9äöüÄÖÜß_-]+/g, '_').replace(/^_+|_+$/g, '') || 'Dokument'
}

function money(value: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value || 0)
}

export function AdditionalDocumentGenerators({ userId, folders }: Props) {
  const [kind, setKind] = useState<GeneratorKind | null>(null)

  return (
    <>
      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <GeneratorCard title="Projekt-Checkliste" description="Ausfüllbare Angebots-Checkliste für PV- oder BESS-Projekte zum Versenden an Partner und Vertriebler." onClick={() => setKind('project-checklist')} />
        <GeneratorCard title="Provisionsvereinbarung" description="Pauschal, €/kWp, €/MWh oder prozentual – mit automatischer Berechnung." onClick={() => setKind('commission')} />
        <GeneratorCard title="Investoren-Suchprofil" description="Zweisprachiges Suchprofil für neue Investoren, direkt als PDF speicherbar." onClick={() => setKind('investor-profile')} />
      </div>
      {kind === 'project-checklist' && <ProjectChecklistGenerator userId={userId} folders={folders} onClose={() => setKind(null)} />}
      {kind === 'commission' && <CommissionGenerator userId={userId} folders={folders} onClose={() => setKind(null)} />}
      {kind === 'investor-profile' && <InvestorProfileGenerator userId={userId} folders={folders} onClose={() => setKind(null)} />}
    </>
  )
}

function GeneratorCard({ title, description, onClick }: { title: string; description: string; onClick: () => void }) {
  return <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start gap-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#5CB800]/12 text-[#2F8A00]"><FileText className="h-6 w-6" /></span><div className="min-w-0 flex-1"><h2 className="text-lg font-extrabold text-[#07142F]">{title}</h2><p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p><button type="button" onClick={onClick} className="btn-primary mt-4">Erstellen</button></div></div></section>
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/50 p-3 md:items-center"><div className="max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-[2rem] bg-white p-5 shadow-2xl md:p-7"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-[.12em] text-[#2F8A00]">Dokumenten-Generator</p><h2 className="mt-1 text-2xl font-extrabold text-[#07142F]">{title}</h2></div><button type="button" onClick={onClose} className="btn-icon"><X className="h-5 w-5" /></button></div>{children}</div></div>
}

function PdfActions({ onSave, saving }: { onSave: () => void; saving: boolean }) {
  return <div className="mt-6"><button type="button" onClick={onSave} disabled={saving} className="btn-primary inline-flex w-full items-center justify-center gap-2"><Save className="h-4 w-4" />{saving ? 'Wird gespeichert…' : 'PDF erstellen und speichern'}</button></div>
}

function CommissionGenerator({ userId, folders, onClose }: Props & { onClose: () => void }) {
  const router = useRouter()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ language: 'de' as Language, company: '', contact: '', address: '', project: '', projectNumber: '', date: new Date().toISOString().slice(0, 10), model: 'flat', rate: '', size: '', purchasePrice: '', paymentTerm: 'Nach Closing', folderId: '' })
  const set = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }))
  const total = useMemo(() => {
    const rate = Number(form.rate.replace(',', '.')) || 0
    const size = Number(form.size.replace(',', '.')) || 0
    const price = Number(form.purchasePrice.replace(',', '.')) || 0
    if (form.model === 'flat') return rate
    if (form.model === 'percent') return price * rate / 100
    return rate * size
  }, [form])

  const save = async () => {
    if (!form.company.trim()) return toast.error('Bitte Unternehmen eintragen.')
    setSaving(true)
    try {
      const de = form.language === 'de'
      const doc = new jsPDF({ unit: 'mm', format: 'a4' })
      doc.setFillColor(11, 22, 51); doc.rect(0, 0, 210, 34, 'F'); doc.setFillColor(92, 184, 0); doc.rect(0, 34, 210, 2.5, 'F')
      doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text(de ? 'PROVISIONSVEREINBARUNG' : 'COMMISSION AGREEMENT', 20, 19); doc.setFontSize(9); doc.text('EMA Enterprise GmbH', 20, 28)
      doc.setTextColor(31, 42, 68); doc.setFontSize(11); let y = 52
      const line = (label: string, value: string) => { doc.setFont('helvetica', 'bold'); doc.text(label, 20, y); doc.setFont('helvetica', 'normal'); doc.text(value || '—', 72, y); y += 9 }
      line(de ? 'Vertragspartner' : 'Contracting party', form.company); line(de ? 'Ansprechpartner' : 'Contact person', form.contact); line(de ? 'Anschrift' : 'Address', form.address); line(de ? 'Projekt' : 'Project', form.project); line(de ? 'Projektnummer' : 'Project number', form.projectNumber); line(de ? 'Vertragsdatum' : 'Agreement date', form.date)
      const modelLabel = form.model === 'flat' ? (de ? 'Pauschalbetrag' : 'Flat fee') : form.model === 'pv' ? '€/kWp (PV)' : form.model === 'bess' ? '€/MWh (BESS)' : (de ? 'Prozent' : 'Percentage')
      line(de ? 'Provisionsmodell' : 'Commission model', modelLabel)
      if (form.model === 'flat') line(de ? 'Pauschalbetrag' : 'Flat fee', money(total))
      if (form.model === 'pv') { line('€/kWp', form.rate); line(de ? 'Anlagengröße' : 'Plant size', `${form.size} kWp`) }
      if (form.model === 'bess') { line('€/MWh', form.rate); line(de ? 'Speichergröße' : 'Storage size', `${form.size} MWh`) }
      if (form.model === 'percent') { line(de ? 'Provisionssatz' : 'Commission rate', `${form.rate} %`); line(de ? 'Kaufpreis' : 'Purchase price', money(Number(form.purchasePrice.replace(',', '.')) || 0)) }
      line(de ? 'Gesamtprovision' : 'Total commission', money(total)); line(de ? 'Zahlungsbedingung' : 'Payment term', form.paymentTerm)
      y += 12; doc.setFontSize(9); doc.setTextColor(70); const text = de ? 'Die Provision wird gemäß dem oben gewählten Modell berechnet und nach Eintritt der vereinbarten Zahlungsbedingung fällig. Änderungen bedürfen der Textform.' : 'The commission is calculated according to the model selected above and becomes due when the agreed payment condition is met. Amendments must be made in text form.'; doc.text(doc.splitTextToSize(text, 170), 20, y)
      y += 35; doc.setDrawColor(120); doc.line(20, y, 88, y); doc.line(122, y, 190, y); doc.setFontSize(8); doc.text('EMA Enterprise GmbH', 20, y + 6); doc.text(form.company, 122, y + 6)
      const blob = doc.output('blob'); const fileName = `Provisionsvereinbarung_${clean(form.company)}_${form.date}_v1.0.pdf`; const path = `${userId}/${Date.now()}_${fileName}`
      const { error } = await supabase.storage.from('template-documents').upload(path, blob, { contentType: 'application/pdf', upsert: false }); if (error) throw error
      const result = await createTemplateDocumentRecord({ displayName: `Provisionsvereinbarung – ${form.company} – v1.0`, category: 'commission', fileName, filePath: path, fileSizeBytes: blob.size, mimeType: 'application/pdf', folderId: form.folderId || null }); if (result.error) throw new Error(result.error)
      toast.success('Provisionsvereinbarung wurde gespeichert.'); onClose(); router.refresh()
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Dokument konnte nicht gespeichert werden.') } finally { setSaving(false) }
  }

  return <Modal title="Provisionsvereinbarung" onClose={onClose}><LanguageButtons value={form.language} onChange={(value) => set('language', value)} /><div className="mt-6 grid gap-3 md:grid-cols-2"><Input value={form.company} onChange={(v) => set('company', v)} placeholder="Unternehmen / Company" wide /><Input value={form.contact} onChange={(v) => set('contact', v)} placeholder="Ansprechpartner / Contact person" /><Input value={form.address} onChange={(v) => set('address', v)} placeholder="Anschrift / Address" /><Input value={form.project} onChange={(v) => set('project', v)} placeholder="Projekt / Project" /><Input value={form.projectNumber} onChange={(v) => set('projectNumber', v)} placeholder="Projektnummer / Project number" /><Input type="date" value={form.date} onChange={(v) => set('date', v)} placeholder="Datum" /></div><select className="form-input mt-3 w-full" value={form.model} onChange={(e) => set('model', e.target.value)}><option value="flat">Pauschalbetrag</option><option value="pv">€/kWp (PV)</option><option value="bess">€/MWh (BESS)</option><option value="percent">Prozent (%)</option></select><div className="mt-3 grid gap-3 md:grid-cols-2"><Input value={form.rate} onChange={(v) => set('rate', v)} placeholder={form.model === 'flat' ? 'Pauschalbetrag (€)' : form.model === 'percent' ? 'Provisionssatz (%)' : form.model === 'pv' ? 'Vergütung (€/kWp)' : 'Vergütung (€/MWh)'} />{form.model === 'percent' ? <Input value={form.purchasePrice} onChange={(v) => set('purchasePrice', v)} placeholder="Kaufpreis (€)" /> : form.model !== 'flat' ? <Input value={form.size} onChange={(v) => set('size', v)} placeholder={form.model === 'pv' ? 'Anlagengröße (kWp)' : 'Speichergröße (MWh)'} /> : null}</div><p className="mt-3 rounded-xl bg-slate-50 px-4 py-3 font-extrabold text-[#07142F]">Gesamtprovision: {money(total)}</p><select className="form-input mt-3 w-full" value={form.paymentTerm} onChange={(e) => set('paymentTerm', e.target.value)}><option>Nach Vertragsunterzeichnung</option><option>Nach Zahlungseingang</option><option>Nach Closing</option><option>Nach Netzanschluss</option><option>Individuell</option></select><FolderSelect value={form.folderId} folders={folders} onChange={(v) => set('folderId', v)} /><PdfActions onSave={save} saving={saving} /></Modal>
}

function InvestorProfileGenerator({ userId, folders, onClose }: Props & { onClose: () => void }) {
  const router = useRouter(); const supabase = createClient(); const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ company: '', contact: '', position: '', email: '', phone: '', country: '', technologies: '', pvFrom: '', pvTo: '', bessFrom: '', bessTo: '', stages: '', models: '', regions: '', volume: '', criteria: '', irr: '', comments: '', folderId: '' })
  const set = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }))
  const save = async () => { if (!form.company.trim()) return toast.error('Bitte Firmenname eintragen.'); setSaving(true); try { const doc = new jsPDF({ unit: 'mm', format: 'a4' }); const sections: Array<[string, string]> = [['1 Unternehmensdaten / Company Information', `${form.company}\n${form.contact} · ${form.position}\n${form.email} · ${form.phone}\n${form.country}`], ['2 Gesuchte Technologie / Preferred Technology', form.technologies], ['3 Gesuchte Projektgröße / Preferred Project Size', `PV: ${form.pvFrom}–${form.pvTo} MWp\nBESS: ${form.bessFrom}–${form.bessTo} MWh`], ['4 Projektstatus / Preferred Project Stage', form.stages], ['5 Investitionsmodell / Investment Model', form.models], ['6 Bevorzugte Regionen / Preferred Regions', form.regions], ['7 Investitionsvolumen / Investment Volume', form.volume], ['8 Besondere Anforderungen / Additional Criteria', `${form.criteria}\nMindest-IRR / Minimum IRR: ${form.irr}%`], ['9 Bemerkungen / Comments', form.comments]]; let y = 20; const header = () => { doc.setFillColor(11,22,51); doc.rect(0,0,210,24,'F'); doc.setTextColor(255); doc.setFont('helvetica','bold'); doc.setFontSize(15); doc.text('Investoren-Suchprofil | Investor Profile',20,15); y = 34 }; header(); for (const [title, value] of sections) { const lines = doc.splitTextToSize(value || '—', 170); if (y + 16 + lines.length * 5 > 280) { doc.addPage(); header() } doc.setTextColor(31,42,68); doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.text(title,20,y); y += 7; doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.text(lines,20,y); y += lines.length * 5 + 8 } const pages = doc.getNumberOfPages(); for (let p=1;p<=pages;p+=1) { doc.setPage(p); doc.setFontSize(7.5); doc.setTextColor(120); doc.text(`EMA Enterprise GmbH · Vertraulich / Confidential · ${p}/${pages}`,105,290,{align:'center'}) } const blob = doc.output('blob'); const date = new Date().toISOString().slice(0,10); const fileName = `Investoren-Suchprofil_${clean(form.company)}_${date}_v1.0.pdf`; const path = `${userId}/${Date.now()}_${fileName}`; const { error } = await supabase.storage.from('template-documents').upload(path, blob, { contentType:'application/pdf', upsert:false }); if (error) throw error; const result = await createTemplateDocumentRecord({ displayName:`Investoren-Suchprofil – ${form.company} – v1.0`, category:'investor-profile', fileName, filePath:path, fileSizeBytes:blob.size, mimeType:'application/pdf', folderId:form.folderId || null }); if (result.error) throw new Error(result.error); toast.success('Investoren-Suchprofil wurde gespeichert.'); onClose(); router.refresh() } catch(error) { toast.error(error instanceof Error ? error.message : 'Dokument konnte nicht gespeichert werden.') } finally { setSaving(false) } }
  return <Modal title="Investoren-Suchprofil | Investor Profile" onClose={onClose}><p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">Für neue, noch nicht angelegte Investoren. Das ausgefüllte Profil kann später zum Anlegen eines Investor-Datensatzes verwendet werden.</p><div className="mt-4 grid gap-3 md:grid-cols-2"><Input value={form.company} onChange={(v)=>set('company',v)} placeholder="Firmenname / Company name" wide />{['contact','position','email','phone','country','technologies','pvFrom','pvTo','bessFrom','bessTo','stages','models','regions','volume','criteria','irr'].map((key)=><Input key={key} value={(form as any)[key]} onChange={(v)=>set(key,v)} placeholder={key} />)}</div><textarea className="form-input mt-3 min-h-28 w-full" value={form.comments} onChange={(e)=>set('comments',e.target.value)} placeholder="Bemerkungen / Comments" /><FolderSelect value={form.folderId} folders={folders} onChange={(v)=>set('folderId',v)} /><PdfActions onSave={save} saving={saving} /></Modal>
}

function LanguageButtons({ value, onChange }: { value: Language; onChange: (value: Language) => void }) { return <div className="mt-6 grid grid-cols-2 gap-3"><button type="button" onClick={()=>onChange('de')} className={`rounded-2xl border px-4 py-3 font-extrabold ${value==='de'?'border-[#5CB800] bg-[#5CB800]/10 text-[#2F8A00]':'border-slate-200'}`}>🇩🇪 Deutsch</button><button type="button" onClick={()=>onChange('en')} className={`rounded-2xl border px-4 py-3 font-extrabold ${value==='en'?'border-[#5CB800] bg-[#5CB800]/10 text-[#2F8A00]':'border-slate-200'}`}>🇬🇧 English</button></div> }
function Input({ value, onChange, placeholder, type='text', wide=false }: { value:string; onChange:(value:string)=>void; placeholder:string; type?:string; wide?:boolean }) { return <input type={type} className={`form-input ${wide?'md:col-span-2':''}`} value={value} onChange={(e)=>onChange(e.target.value)} placeholder={placeholder} /> }
function FolderSelect({ value, folders, onChange }: { value:string; folders:FolderItem[]; onChange:(value:string)=>void }) { return <select className="form-input mt-3 w-full" value={value} onChange={(e)=>onChange(e.target.value)}><option value="">Kein Ordner</option>{folders.map((folder)=><option key={folder.id} value={folder.id}>{folder.name}</option>)}</select> }
