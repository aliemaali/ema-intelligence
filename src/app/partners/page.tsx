'use client'

import { useEffect, useMemo, useState } from 'react'
import { Building2, Mail, Phone, Plus, Search, UserRound, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Partner = {
  id: string
  company: string | null
  full_name: string
  email: string | null
  phone: string | null
  category: string
  notes: string | null
}

const CATEGORIES = ['Vertriebspartner', 'EPC', 'Projektentwickler', 'Sonstige']

const emptyForm = {
  company: '',
  full_name: '',
  email: '',
  phone: '',
  category: 'Vertriebspartner',
  notes: '',
}

const fieldClass = 'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-[#07142F] shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#5CB800] focus:ring-4 focus:ring-[#5CB800]/10'

export default function PartnersPage() {
  const supabase = createClient()
  const [partners, setPartners] = useState<Partner[]>([])
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  async function loadPartners() {
    const { data, error } = await supabase
      .from('partners')
      .select('id, company, full_name, email, phone, category, notes')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Partner konnten nicht geladen werden:', error.message)
      setPartners([])
      return
    }

    setPartners((data ?? []) as Partner[])
  }

  useEffect(() => {
    loadPartners()
  }, [])

  const filteredPartners = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return partners
    return partners.filter((partner) =>
      [partner.company, partner.full_name, partner.email, partner.category]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    )
  }, [partners, search])

  const salesPartners = partners.filter((partner) => partner.category === 'Vertriebspartner').length
  const partnersWithEmail = partners.filter((partner) => Boolean(partner.email)).length

  async function savePartner() {
    const { data: userData } = await supabase.auth.getUser()
    const user = userData.user

    if (!user) {
      alert('Nicht angemeldet')
      return
    }

    if (!form.company.trim()) {
      alert('Firmenname fehlt')
      return
    }

    if (!form.full_name.trim()) {
      alert('Ansprechpartner fehlt')
      return
    }

    setSaving(true)
    const { error } = await supabase.from('partners').insert({
      user_id: user.id,
      company: form.company.trim(),
      full_name: form.full_name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      category: form.category,
      notes: form.notes.trim() || null,
    })
    setSaving(false)

    if (error) {
      alert('Fehler beim Speichern: ' + error.message)
      return
    }

    setForm(emptyForm)
    setShowForm(false)
    await loadPartners()
  }

  return (
    <div className="min-h-screen w-full bg-[#F4F6F9]">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-[#07142F]">Partner</h1>
            <p className="mt-1 text-sm text-muted-foreground">Partnerverwaltung für Vertrieb und Projektentwicklung</p>
          </div>
          <button className="btn-primary inline-flex items-center gap-2" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" /> Neuer Partner
          </button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <Users className="h-5 w-5 text-[#1F2A44]" />
            <p className="mt-4 text-2xl font-extrabold text-[#07142F]">{partners.length}</p>
            <p className="text-xs text-muted-foreground">Partner gesamt</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <UserRound className="h-5 w-5 text-[#5CB800]" />
            <p className="mt-4 text-2xl font-extrabold text-[#07142F]">{salesPartners}</p>
            <p className="text-xs text-muted-foreground">Vertriebspartner</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <Mail className="h-5 w-5 text-blue-600" />
            <p className="mt-4 text-2xl font-extrabold text-[#07142F]">{partnersWithEmail}</p>
            <p className="text-xs text-muted-foreground">Mit E-Mail-Kontakt</p>
          </div>
        </div>

        {showForm && (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
            <div className="mb-6 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold text-[#07142F]">Neuer Partner</h2>
                <p className="text-sm text-muted-foreground">Kontaktdaten und Partnerart erfassen</p>
              </div>
              <button className="btn-secondary" onClick={() => setShowForm(false)}>Abbrechen</button>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-bold text-[#1F2A44]">Firmenname *</span>
                <input className={fieldClass} placeholder="z. B. Sonnen-Fix GmbH" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-bold text-[#1F2A44]">Ansprechpartner *</span>
                <input className={fieldClass} placeholder="Vor- und Nachname" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-bold text-[#1F2A44]">E-Mail</span>
                <input className={fieldClass} type="email" placeholder="name@unternehmen.de" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-bold text-[#1F2A44]">Telefon</span>
                <input className={fieldClass} placeholder="+49 …" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </label>
              <label className="space-y-2 md:max-w-md">
                <span className="text-sm font-bold text-[#1F2A44]">Partnerart</span>
                <select className={fieldClass} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-bold text-[#1F2A44]">Notizen</span>
                <textarea className={`${fieldClass} min-h-28 resize-y`} placeholder="Zusätzliche Informationen zum Partner" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </label>
            </div>

            <div className="mt-6 flex justify-end">
              <button className="btn-primary min-w-44" disabled={saving} onClick={savePartner}>
                {saving ? 'Wird gespeichert …' : 'Partner speichern'}
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 flex items-center rounded-2xl border border-slate-200 bg-white px-4 shadow-sm">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            className="w-full bg-transparent px-3 py-3 text-sm text-[#07142F] outline-none placeholder:text-slate-400"
            placeholder="Firma, Ansprechpartner, E-Mail oder Partnerart suchen …"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <p className="mt-5 text-sm text-muted-foreground">{filteredPartners.length} Partner gefunden</p>

        {filteredPartners.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
            <Building2 className="mx-auto h-8 w-8 text-slate-400" />
            <p className="mt-3 font-semibold text-[#07142F]">Noch keine Partner vorhanden</p>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredPartners.map((partner) => (
              <article key={partner.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#1F2A44]/8 text-[#1F2A44]">
                      <Building2 className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <h2 className="truncate font-extrabold text-[#07142F]">{partner.company || partner.full_name}</h2>
                      <span className="mt-1 inline-flex rounded-full bg-[#5CB800]/10 px-2.5 py-1 text-[10px] font-extrabold text-[#2F8A00]">{partner.category}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 space-y-2 text-sm text-slate-600">
                  {partner.full_name && <p className="flex items-center gap-2"><UserRound className="h-4 w-4" />{partner.full_name}</p>}
                  {partner.email && <a className="flex items-center gap-2 hover:text-[#2F8A00]" href={`mailto:${partner.email}`}><Mail className="h-4 w-4" />{partner.email}</a>}
                  {partner.phone && <a className="flex items-center gap-2 hover:text-[#2F8A00]" href={`tel:${partner.phone}`}><Phone className="h-4 w-4" />{partner.phone}</a>}
                </div>

                {partner.notes && <p className="mt-4 border-t border-slate-100 pt-4 text-sm text-muted-foreground">{partner.notes}</p>}
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
