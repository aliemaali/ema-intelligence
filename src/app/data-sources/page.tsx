import { DatabaseZap } from 'lucide-react'
import { SoldeskConnectionPanel } from '@/components/data-sources/SoldeskConnectionPanel'

export const metadata = { title: 'Datenquellen' }

export default function DataSourcesPage() {
  return (
    <div className="page-container pt-[max(env(safe-area-inset-top),1rem)] sm:pt-0">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#5CB800]/10 text-[#2F8A00] shadow-sm">
            <DatabaseZap className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-4xl font-black leading-none tracking-[-0.05em] text-[#07142F] sm:text-5xl">Datenquellen</h1>
            <p className="mt-2 max-w-xl text-base leading-snug text-muted-foreground sm:text-lg">
              Verbinde EMA mit externen Projektportalen.
            </p>
          </div>
        </div>

        <span className="mt-1 shrink-0 rounded-full bg-[#5CB800]/10 px-4 py-2 text-sm font-black text-[#2F8A00]">
          v1.4.0
        </span>
      </div>

      <SoldeskConnectionPanel />
    </div>
  )
}
