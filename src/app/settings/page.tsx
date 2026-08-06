import Link from 'next/link'
import { ChevronRight, LockKeyhole, ShieldCheck, Smartphone, UserCog } from 'lucide-react'

export const metadata = { title: 'Einstellungen' }

const settingsItems = [
  {
    href: '/partner-management',
    title: 'Benutzerverwaltung',
    description: 'Administratoren, Vertriebspartner und Projektentwickler verwalten.',
    icon: UserCog,
    eyebrow: 'Zugänge & Rollen',
  },
  {
    href: '/settings/security',
    title: 'Sicherheit',
    description: 'Face ID, Passkeys und registrierte Geräte verwalten.',
    icon: ShieldCheck,
    eyebrow: 'Passkeys & Geräte',
  },
]

export default function SettingsPage() {
  return (
    <div className="w-full max-w-full space-y-6 overflow-x-hidden pb-28 md:mx-auto md:max-w-[1480px] md:space-y-7">
      <section className="relative mx-3 overflow-hidden rounded-[2rem] bg-[#07142F] text-white shadow-[0_20px_55px_rgba(15,23,42,0.16)] md:mx-0">
        <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-[#5CB800]/18 blur-3xl" />
        <div className="absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="relative px-6 py-7 md:px-10 md:py-10">
          <div className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-extrabold uppercase tracking-[.18em] text-[#87D33B] ring-1 ring-white/15">
              <LockKeyhole className="h-4 w-4" /> EMA Administration
            </span>
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-white ring-1 ring-white/15">
              <Smartphone className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-10 max-w-3xl md:mt-14">
            <p className="text-xs font-extrabold uppercase tracking-[.24em] text-[#87D33B]">Einstellungen & Sicherheit</p>
            <h1 className="mt-3 text-4xl font-extrabold tracking-[-0.045em] md:text-6xl">EMA sicher verwalten</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-white/72 md:text-base">
              Benutzer, Rollen, Passkeys und Geräte an einem zentralen Ort – optimiert für iPhone und PWA.
            </p>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 md:max-w-2xl">
            <div className="rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/10">
              <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-white/55">Anmeldung</p>
              <p className="mt-1 text-sm font-extrabold text-white">Passkey & Face ID</p>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/10">
              <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-white/55">Gerätefokus</p>
              <p className="mt-1 text-sm font-extrabold text-white">iPhone & PWA</p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-3 md:px-0">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#5CB800]">Administration</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-[-0.035em] text-[#07142F]">Kontrollzentrum</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Nur vorhandene und vollständig nutzbare Bereiche werden angezeigt.</p>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {settingsItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className="group premium-lift relative overflow-hidden rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-[0_12px_34px_rgba(15,23,42,0.06)] transition hover:border-[#5CB800]/40 md:p-6"
              >
                <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-[#5CB800]/7 transition group-hover:scale-110" />
                <div className="relative flex items-start gap-4">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#07142F] text-white shadow-sm">
                    <Icon className="h-6 w-6" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[10px] font-extrabold uppercase tracking-[.16em] text-[#2F8A00]">{item.eyebrow}</span>
                    <span className="mt-2 block text-xl font-extrabold tracking-[-0.025em] text-[#07142F]">{item.title}</span>
                    <span className="mt-2 block text-sm leading-6 text-slate-500">{item.description}</span>
                  </span>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 transition group-hover:bg-[#5CB800]/10 group-hover:text-[#2F8A00]">
                    <ChevronRight className="h-5 w-5" />
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      </section>
    </div>
  )
}
