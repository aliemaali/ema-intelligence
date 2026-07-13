import Link from 'next/link'
import { ChevronRight, ShieldCheck, UserCog } from 'lucide-react'

export const metadata = { title: 'Einstellungen' }

export default function SettingsPage() {
  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#5CB800]">Administration</p>
          <h1 className="page-title mt-1">Einstellungen</h1>
          <p className="mt-2 text-sm text-muted-foreground">Zugänge und administrative Bereiche zentral verwalten.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link
          href="/partner-management"
          className="group flex min-h-36 items-center gap-4 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#5CB800]/40 hover:shadow-md active:scale-[0.99]"
        >
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#5CB800]/10 text-[#5CB800]">
            <UserCog className="h-7 w-7" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-extrabold text-[#07142F]">Partnerzugänge</span>
            <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">Partner einladen, Kontaktdaten pflegen sowie Zugänge aktivieren oder sperren.</span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-slate-300 transition group-hover:text-[#5CB800]" />
        </Link>

        <div className="flex min-h-36 items-center gap-4 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#1F2A44]/8 text-[#1F2A44]">
            <ShieldCheck className="h-7 w-7" />
          </span>
          <span>
            <span className="block text-lg font-extrabold text-[#07142F]">Sicherheit</span>
            <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">Weitere Sicherheits- und Profileinstellungen folgen in einem späteren Schritt.</span>
          </span>
        </div>
      </div>
    </div>
  )
}
