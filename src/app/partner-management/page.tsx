import { redirect } from 'next/navigation'
import { Building2, Mail, ShieldCheck, UserPlus } from 'lucide-react'
import { invitePartnerAccount, updatePartnerAccount } from '@/lib/actions/partner-management.actions'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'Partnerverwaltung' }

const PARTNER_ROLES = ['partner', 'sales_partner', 'vertriebspartner']

const controlClassName = 'mt-2 w-full appearance-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[#07142F] [color-scheme:light] placeholder:text-slate-400'

function normalizedRole(role: string) {
  return role === 'sales_partner' || role === 'vertriebspartner' ? 'sales_partner' : 'partner'
}

function RoleSelect({ defaultValue = 'sales_partner' }: { defaultValue?: string }) {
  return (
    <label>
      <span className="text-sm font-bold">Rolle</span>
      <select name="role" defaultValue={normalizedRole(defaultValue)} className={controlClassName}>
        <option value="sales_partner">Vertriebspartner</option>
        <option value="partner">Projektentwickler</option>
      </select>
    </label>
  )
}

export default async function PartnerManagementPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!profile || !['admin', 'owner'].includes(String(profile.role).toLowerCase())) redirect('/dashboard')

  const { data: partnersData } = await supabase
    .from('profiles')
    .select('id, email, full_name, company, phone, role, is_active, created_at')
    .in('role', PARTNER_ROLES)
    .order('created_at', { ascending: false })

  const partners = partnersData ?? []
  const ids = partners.map((partner) => partner.id)
  const counts = new Map<string, number>()

  if (ids.length > 0) {
    const { data: submissions } = await supabase.from('project_submissions').select('partner_user_id').in('partner_user_id', ids)
    for (const row of submissions ?? []) counts.set(row.partner_user_id, (counts.get(row.partner_user_id) ?? 0) + 1)
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div>
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#2F8A00]">Administration</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[#07142F]">Partnerverwaltung</h1>
        <p className="mt-2 text-sm text-muted-foreground">Zugänge einladen, Kontaktdaten pflegen und Partner aktivieren oder sperren.</p>
      </div>

      <section className="rounded-[2rem] bg-white p-6 shadow-sm md:p-8">
        <div className="flex items-start gap-3"><UserPlus className="mt-1 h-6 w-6 text-[#2F8A00]" /><div><h2 className="text-xl font-extrabold">Neuen Partner einladen</h2><p className="mt-1 text-sm text-muted-foreground">Der Partner erhält eine sichere E-Mail zum Einrichten seines Zugangs.</p></div></div>
        <form action={invitePartnerAccount} className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field name="full_name" label="Name *" required />
          <Field name="company" label="Unternehmen" />
          <Field name="email" label="E-Mail *" type="email" required />
          <Field name="phone" label="Telefon" type="tel" />
          <RoleSelect />
          <button className="self-end min-h-12 rounded-2xl bg-[#5CB800] px-5 py-3 font-extrabold text-white">Einladung senden</button>
        </form>
      </section>

      <section>
        <div className="flex items-center justify-between"><h2 className="text-2xl font-extrabold">Partnerkonten</h2><span className="rounded-full bg-white px-3 py-1.5 text-sm font-extrabold shadow-sm">{partners.length}</span></div>
        <div className="mt-4 space-y-4">
          {partners.length === 0 && <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-muted-foreground">Noch keine Partnerkonten angelegt.</div>}
          {partners.map((partner) => (
            <form key={partner.id} action={updatePartnerAccount} className="rounded-[2rem] bg-white p-5 shadow-sm md:p-6">
              <input type="hidden" name="partner_id" value={partner.id} />
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1F2A44]/8"><Building2 className="h-5 w-5" /></span><div><h3 className="font-extrabold">{partner.company || partner.full_name}</h3><p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><Mail className="h-4 w-4" /> {partner.email}</p></div></div>
                <div className="flex items-center gap-2"><span className={`rounded-full px-3 py-1 text-xs font-extrabold ${partner.is_active ? 'bg-[#5CB800]/10 text-[#2F8A00]' : 'bg-red-50 text-red-700'}`}>{partner.is_active ? 'Aktiv' : 'Gesperrt'}</span><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-extrabold">{counts.get(partner.id) ?? 0} Projekte</span></div>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <Field name="full_name" label="Name" defaultValue={partner.full_name ?? ''} required />
                <Field name="company" label="Unternehmen" defaultValue={partner.company ?? ''} />
                <Field name="phone" label="Telefon" defaultValue={partner.phone ?? ''} />
                <RoleSelect defaultValue={partner.role} />
                <label><span className="text-sm font-bold">Zugang</span><select name="is_active" defaultValue={String(partner.is_active)} className={controlClassName}><option value="true">Aktiv</option><option value="false">Gesperrt</option></select></label>
              </div>
              <button className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-2xl bg-[#1F2A44] px-5 py-3 text-sm font-extrabold text-white"><ShieldCheck className="h-4 w-4" /> Änderungen speichern</button>
            </form>
          ))}
        </div>
      </section>
    </div>
  )
}

function Field({ name, label, type = 'text', required = false, defaultValue }: { name: string; label: string; type?: string; required?: boolean; defaultValue?: string }) {
  return <label><span className="text-sm font-bold">{label}</span><input name={name} type={type} required={required} defaultValue={defaultValue} className={controlClassName} /></label>
}
