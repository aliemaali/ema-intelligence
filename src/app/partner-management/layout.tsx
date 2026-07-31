import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function PartnerManagementLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="pb-8 pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="mx-auto mb-4 flex w-full max-w-6xl items-center px-4 sm:px-0">
        <Link
          href="/settings"
          aria-label="Zurück zu den Einstellungen"
          className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-[#07142F] shadow-sm transition hover:border-[#5CB800]/40 hover:text-[#2F8A00] active:scale-[0.98]"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          Zurück
        </Link>
      </div>
      <div className="px-4 sm:px-0">{children}</div>
    </div>
  )
}
