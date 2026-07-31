import Link from 'next/link'
import { ChevronRight, ShieldCheck, UserCog } from 'lucide-react'

export const metadata = { title: 'Einstellungen' }

const settingsItems = [
  {
    href: '/partner-management',
    title: 'Benutzerverwaltung',
    description: 'Administratoren, Vertriebspartner und Projektentwickler verwalten.',
    icon: UserCog,
  },
  {
    href: '/settings/security',
    title: 'Sicherheit',
    description: 'Face ID, Passkeys und registrierte Geräte verwalten.',
    icon: ShieldCheck,
  },
]

export default function SettingsPage() {
  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#5CB800]">Administration</p>
          <h1 className="page-title mt-1">Einstellungen</h1>
          <p className="mt-2 text-sm text-muted-foreground">Zugänge, Benutzer und Sicherheit zentral verwalten.</p>
        </div>
      </div>

      <div className="grid max-w-2xl gap-4">
        {settingsItems.map((item) => {
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className="group flex items-center gap-4 rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#5CB800]/40 hover:shadow-md active:scale-[0.99]"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#5CB800]/10 text-[#5CB800]">
                <Icon className="h-6 w-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-extrabold text-[#07142F]">{item.title}</span>
                <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{item.description}</span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-slate-300 transition group-hover:text-[#5CB800]" />
            </Link>
          )
        })}
      </div>
    </div>
  )
}
