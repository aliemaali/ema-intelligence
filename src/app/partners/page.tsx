'use client'

import { useEffect, useMemo, useState } from 'react'
import { Building2, FileText, Mail, Pencil, Phone, Plus, Search, UserRound, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Partner {
  id: string
  company: string | null
  full_name: string
  email: string | null
  phone: string | null
  category: string
  notes: string | null
}

const CATEGORIES = ['Vertriebspartner', 'EPC', 'Projektentwickler', 'Sonstige']
const emptyForm = { company: '', full_name: '', email: '', phone: '', category: 'Vertriebspartner', notes: '' }
const fieldClass = 'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-[#07142F] shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#5CB800] focus:ring-4 focus:ring-[#5CB800]/10'

export default function PartnersPage() {
  const supabase = createClient()
  const [partners, setPartners] = useState<Partner[]>([])
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  async function loadPartners() {
    const { data } = await supabase.from('partners').select('id, company, full_name, email, phone, category, notes').order('created_at', { ascending: false })
    setPartners((data ?? []) as Partner[])
  }

  useEffect(() => { loadPartners() }, [])

  const filteredPartners = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return partners
    return partners.filter((partner) => [partner.company, partner.full_name, partner.email, partner.category].filter(Boolean).some((value) => String(value).toLowerCase().includes(query)))
  }, [partners, search])

  async function savePartner() {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user || !form.company.trim() || !form.full_name.trim()) return
    setSaving(true)
    const { error } = await supabase.from('partners').insert({ user_id: userData.user.id, company: form.company.trim(), full_name: form.full_name.trim(), email: form.email.trim() || null, phone: form.phone.trim() || null, category: form.category, notes: form.notes.trim() || null })
    setSaving(false)
    if (error) return alert('Fehler beim Speichern: ' + error.message)
    setForm(emptyForm)
    setShowForm(false)
    await loadPartners()
  }

  const salesPartners = partners.filter((partner) => partner.category === 'Vertriebspartner').length
  const partnersWithEmail = partners.filter((partner) => Boolean(partner.email)).length

  return (
    <div className="min-h-screen w-full bg-[#F4F6F9]">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><h1 className="text-3xl font-extrabold tracking-tight text-[#07142F]">Partner</h1><p className="mt-1 text-sm text-muted-foreground">Partnerverwaltung für Vertrieb und Projektentwicklung</p></div>
          <button className="btn-primary inline-flex items-center gap-2" onClick={() => setShowForm(true)}><Plus className="h-4 w-4" /> Neuer Partner</button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Kpi icon={<Users className="h-5 w-5" />} value={partners.length} label="Partner gesamt" />
          <Kpi icon={<UserRound className="h-5 w-5 text-[#5CB800]" />} value={salesPartners} label="Vertriebspartner" />
          <Kpi icon={<Mail className="h-5 w-5 text-blue-600" />} value={partnersWithEmail} label="Mit E-Mail-Kontakt" />
        </div>

        {showForm && (
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
            <div className="mb-6 flex items-center justify-between"><div><h2 className="text-lg font-extrabold text-[#07142F]">Neuer Partner</h2><p className="text-sm text-muted-foreground">Kontaktdaten und Partnerart erfassen</p></div><button className="btn-secondary" onClick={() => setShowForm(false)}>Abbrechen</button></div>
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Firmenname *"><input className={fieldClass} value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></Field>
              <Field label="Ansprechpartner *"><input className={fieldClass} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field>
              <Field label="E-Mail"><input className={fieldClass} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
              <Field label="Telefon"><input className={fieldClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
              <Field label="Partnerart"><select className={fieldClass} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></Field>
              <label className="space-y-2 md:col-span-2"><span className="text-sm font-bold text-[#1F2A44]">Notizen</span><textarea className={`${fieldClass} min-h-28`} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
            </div>
            <div className="mt-6 flex justify-end"><button className="btn-primary" disabled={saving} onClick={savePartner}>{saving ? 'Wird gespeichert …' : 'Partner speichern'}</button></div>
          </section>
        )}

        <div className="mt-6 flex items-center rounded-2xl border border-slate-200 bg-white px-4 shadow-sm"><Search className="h-4 w-4 text-muted-foreground" /><input className="w-full bg-transparent px-3 py-3 text-sm outline-none" placeholder="Firma, Ansprechpartner, E-Mail oder Partnerart suchen …" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <p className="mt-5 text-sm text-muted-foreground">{filteredPartners.length} Partner gefunden</p>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredPartners.map((partner) => (
            <article key={partner.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1F2A44]/8"><Building2 className="h-5 w-5" /></span><div className="min-w-0"><h2 className="truncate font-extrabold text-[#07142F]">{partner.company || partner.full_name}</h2><span className="mt-1 inline-flex rounded-full bg-[#5CB800]/10 px-2.5 py-1 text-[10px] font-extrabold text-[#2F8A00]">{partner.category}</span></div></div>
              <div className="mt-5 space-y-2 text-sm text-slate-600"><p className="flex items-center gap-2"><UserRound className="h-4 w-4" />{partner.full_name}</p>{partner.email && <a className="flex items-center gap-2" href={`mailto:${partner.email}`}><Mail className="h-4 w-4" />{partner.email}</a>}{partner.phone && <a className="flex items-center gap-2" href={`tel:${partner.phone}`}><Phone className="h-4 w-4" />{partner.phone}</a>}</div>
              <div className="mt-5 grid grid-cols-2 gap-2 border-t border-slate-100 pt-4"><a href={`/partners/${partner.id}`} className="btn-secondary btn-sm justify-center"><Pencil className="h-4 w-4" /> Bearbeiten</a><a href={`/partners/${partner.id}`} className="btn-secondary btn-sm justify-center"><FileText className="h-4 w-4" /> Dokumente</a></div>
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}

function Kpi({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) { return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">{icon}<p className="mt-4 text-2xl font-extrabold text-[#07142F]">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div> }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="space-y-2"><span className="text-sm font-bold text-[#1F2A44]">{label}</span>{children}</label> }
