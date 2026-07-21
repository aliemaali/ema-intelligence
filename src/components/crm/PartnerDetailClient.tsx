'use client'

import { useState, useTransition } from 'react'
import { Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const CATEGORIES = ['Vertriebspartner', 'EPC', 'Projektentwickler', 'Sonstige']
const fieldClass = 'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-[#07142F] shadow-sm outline-none transition focus:border-[#5CB800] focus:ring-4 focus:ring-[#5CB800]/10'

export function PartnerDetailClient({ partner }: { partner: any }) {
  const supabase = createClient()
  const [pending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    company: partner.company ?? '',
    full_name: partner.full_name ?? '',
    email: partner.email ?? '',
    phone: partner.phone ?? '',
    category: partner.category ?? 'Vertriebspartner',
    notes: partner.notes ?? '',
  })

  function save() {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        setError('Nicht angemeldet')
        return
      }

      const { error: updateError } = await supabase
        .from('partners')
        .update({
          company: form.company.trim() || null,
          full_name: form.full_name.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          category: form.category,
          notes: form.notes.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', partner.id)
        .eq('user_id', userData.user.id)

      if (updateError) {
        setError(updateError.message)
        return
      }

      setSaved(true)
    })
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2"><span className="text-sm font-bold text-[#1F2A44]">Firmenname</span><input className={fieldClass} value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></label>
        <label className="space-y-2"><span className="text-sm font-bold text-[#1F2A44]">Ansprechpartner *</span><input className={fieldClass} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></label>
        <label className="space-y-2"><span className="text-sm font-bold text-[#1F2A44]">E-Mail</span><input className={fieldClass} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <label className="space-y-2"><span className="text-sm font-bold text-[#1F2A44]">Telefon</span><input className={fieldClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
        <label className="space-y-2"><span className="text-sm font-bold text-[#1F2A44]">Partnerart</span><select className={fieldClass} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label>
        <label className="space-y-2 md:col-span-2"><span className="text-sm font-bold text-[#1F2A44]">Notizen</span><textarea className={`${fieldClass} min-h-28`} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
      </div>

      {error && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="mt-5 flex justify-end">
        <button type="button" disabled={pending || !form.full_name.trim()} onClick={save} className="btn-primary disabled:opacity-50"><Save className="h-4 w-4" />{pending ? 'Speichert …' : saved ? 'Gespeichert' : 'Änderungen speichern'}</button>
      </div>
    </section>
  )
}
