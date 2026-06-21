'use client'

import { useEffect, useState } from 'react'
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

const CATEGORIES = [
  'Investor',
  'EPC',
  'Projektentwickler',
  'Grundstückseigentümer',
  'Netzbetreiber',
  'Lieferant',
  'Sonstige',
]

export default function PartnersPage() {
  const supabase = createClient()
  const [partners, setPartners] = useState<Partner[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    company_name: '',
    contact_name: '',
    email: '',
    phone: '',
    category: 'Investor',
    notes: '',
  })

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

    const { error } = await supabase.from('partners').insert({
      user_id: user.id,
      company_name: form.company_name,
      contact_name: form.contact_name || null,
      email: form.email || null,
      phone: form.phone || null,
      category: form.category,
      notes: form.notes || null,
    })

    if (error) {
      alert('Fehler beim Speichern: ' + error.message)
      return
    }

    setForm({
      company_name: '',
      contact_name: '',
      email: '',
      phone: '',
      category: 'Investor',
      notes: '',
    })
    setShowForm(false)
    loadPartners()
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Partner</h1>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          + Partner hinzufügen
        </button>
      </div>

      {showForm && (
        <div className="card mt-6 space-y-4">
          <h2 className="text-lg font-semibold">Neuer Partner</h2>

          <input className="input" placeholder="Firmenname" value={form.company_name}
            onChange={(e) => setForm({ ...form, company_name: e.target.value })} />

          <input className="input" placeholder="Ansprechpartner" value={form.contact_name}
            onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />

          <input className="input" placeholder="E-Mail" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} />

          <input className="input" placeholder="Telefon" value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })} />

          <select className="input" value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <textarea className="input" placeholder="Notizen" value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })} />

          <div className="flex gap-3">
            <button className="btn-primary" onClick={savePartner}>Speichern</button>
            <button className="btn-secondary" onClick={() => setShowForm(false)}>Abbrechen</button>
          </div>
        </div>
      )}

      <div className="mt-8 grid gap-4">
        {partners.length === 0 ? (
          <div className="empty-state">
            <p className="text-base font-medium">Noch keine Partner</p>
          </div>
        ) : (
          partners.map((partner) => (
            <div key={partner.id} className="card">
              <div className="flex justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">{partner.company_name}</h2>
                  <p className="text-sm text-muted-foreground">{partner.category}</p>
                  {partner.contact_name && <p>Ansprechpartner: {partner.contact_name}</p>}
                  {partner.email && <p>E-Mail: {partner.email}</p>}
                  {partner.phone && <p>Telefon: {partner.phone}</p>}
                  {partner.notes && <p className="mt-2 text-sm">{partner.notes}</p>}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}