'use client'

import { useEffect, useMemo, useState } from 'react'
import { Building2, Mail, Phone, Plus, Search, UserRound, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Partner = {
  id: string
  company_name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  category: string
  notes: string | null
}

const CATEGORIES = ['Vertriebspartner', 'EPC', 'Projektentwickler', 'Sonstige']

const emptyForm = {
  company_name: '',
  contact_name: '',
  email: '',
  phone: '',
  category: 'Vertriebspartner',
  notes: '',
}

export default function PartnersPage() {
  const supabase = createClient()
  const [partners, setPartners] = useState<Partner[]>([])
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  async function loadPartners() {
    const { data } = await supabase
      .from('partners')
      .select('*')
      .order('created_at', { ascending: false })

    setPartners((data ?? []) as Partner[])
  }

  useEffect(() => {
    loadPartners()
  }, [])

  const filteredPartners = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return partners
    return partners.filter((partner) =>
      [partner.company_name, partner.contact_name, partner.email, partner.category]
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

    if (!form.company_name.trim()) {
      alert('Firmenname fehlt')
      return
    }

    setSaving(true)
    const { error } = await supabase.from('partners').insert({
      user_id: user.id,
      company_name: form.company_name.trim(),
      contact_name: form.contact_name.trim() || null,
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
    loadPartners()
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
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold text-[#07142F]">Neuer Partner</h2>
                <p className="text-sm text-muted-foreground">Kontaktdaten und Partnerart erfassen</p>
              </div>
              <button className="btn-secondary" onClick={() => setShowForm(false)}>Abbrechen</button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <input className="input" placeholder="Firmenname" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
              <input className="input" placeholder="Ansprechpartner" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
              <input className="input" type="email" placeholder="E-Mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <input className="input" placeholder="Telefon" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
              <textarea className="input min-h-24" placeholder="Notizen" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>

            <button className="btn-primary mt-5" disabled={saving} onClick={savePartner}>
              {saving ? 'Wird gespeichert …' : 'Partner speichern'}
            </button>
          </div>
        )}

        <div className="mt-6 flex items-center rounded-2xl border border-slate-200 bg-white px-4 shadow-sm">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            className="w-full bg-transparent px-3 py-3 text-sm outline-none"
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
                      <h2 className="truncate font-extrabold text-[#07142F]">{partner.company_name}</h2>
                      <span className="mt-1 inline-flex rounded-full bg-[#5CB800]/10 px-2.5 py-1 text-[10px] font-extrabold text-[#2F8A00]">{partner.category}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 space-y-2 text-sm text-slate-600">
                  {partner.contact_name && <p className="flex items-center gap-2"><UserRound className="h-4 w-4" />{partner.contact_name}</p>}
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
