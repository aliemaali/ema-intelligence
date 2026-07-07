import Link from 'next/link'
import { getProjects } from '@/lib/actions/project.actions'

export const metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
  const projects = await getProjects({})

  const totalProjects = projects.length
  const totalKwp = projects.reduce((sum: number, p: any) => sum + Number(p.pv_mwp ?? 0), 0)
  const totalBess = projects.reduce((sum: number, p: any) => sum + Number(p.bess_mwh ?? 0), 0)

  const investorSearch = projects.filter((p: any) => p.status === 'investorensuche').length
  const leadProjects = projects.filter((p: any) => p.status === 'lead').length

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Überblick über deine EMA Intelligence Projekte
          </p>
        </div>

        <Link href="/projects/new" className="btn-primary">
          + Neues Projekt
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card-padded">
          <p className="text-xs text-muted-foreground">Projekte gesamt</p>
          <p className="text-2xl font-semibold mt-1">{totalProjects}</p>
        </div>

        <div className="card-padded">
          <p className="text-xs text-muted-foreground">PV-Leistung</p>
          <p className="text-2xl font-semibold mt-1">{totalKwp.toLocaleString('de-DE')} kWp</p>
        </div>

        <div className="card-padded">
          <p className="text-xs text-muted-foreground">BESS-Kapazität</p>
          <p className="text-2xl font-semibold mt-1">{totalBess.toFixed(1)} MWh</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card-padded">
          <h2 className="text-base font-semibold mb-3">Pipeline</h2>

          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Investorensuche</span>
              <span className="font-medium">{investorSearch}</span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Leads</span>
              <span className="font-medium">{leadProjects}</span>
            </div>
          </div>
        </div>

        <div className="card-padded">
          <h2 className="text-base font-semibold mb-3">Schnellzugriff</h2>

          <div className="flex flex-col gap-2">
            <Link href="/projects" className="btn-secondary justify-center">
              Projekte öffnen
            </Link>

            <Link href="/investors" className="btn-secondary justify-center">
              Investoren öffnen
            </Link>

            <Link href="/deals" className="btn-secondary justify-center">
              Deals öffnen
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
