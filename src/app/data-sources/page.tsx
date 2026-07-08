import { SoldeskConnectionPanel } from '@/components/data-sources/SoldeskConnectionPanel'

export const metadata = { title: 'Datenquellen' }

export default function DataSourcesPage() {
  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#5CB800]">Version 1.3.1</p>
          <h1 className="page-title">Datenquellen</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Hier wird EMA Intelligence mit externen Projektportalen verbunden. Start: Soldesk-Datenraum.
          </p>
        </div>
      </div>

      <SoldeskConnectionPanel />
    </div>
  )
}
