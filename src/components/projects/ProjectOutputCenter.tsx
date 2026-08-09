import Link from 'next/link'
import { AlertTriangle, CheckCircle2, FileText, RefreshCw } from 'lucide-react'
import type { ProjectGeneratedOutput } from '@/lib/projects/master-data'

interface ProjectOutputCenterProps {
  projectId: string
  masterDataVersion?: number | null
  outputMetadata?: Record<string, ProjectGeneratedOutput> | null
}

const outputs = [
  { type: 'investment_memorandum', label: 'Exposé', href: (id: string) => `/expose/${id}` },
  { type: 'project_intake_pdf', label: 'Projektaufnahmebogen', href: (id: string) => `/projects/${id}/documents/project-intake` },
  { type: 'customer_intake_pdf', label: 'Kundenaufnahmebogen', href: (id: string) => `/projects/${id}/documents/customer-intake` },
] as const

function dateLabel(value?: string) {
  if (!value) return null
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function ProjectOutputCenter({ projectId, masterDataVersion, outputMetadata }: ProjectOutputCenterProps) {
  const currentVersion = Number(masterDataVersion ?? 1)
  const metadata = outputMetadata ?? {}

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-bold text-[#1F2A44]">Dokumente aus zentralen Projektdaten</h3>
        <p className="mt-1 text-sm text-muted-foreground">Alle Ausgaben verwenden dieselbe Projektversion. Veraltete Dokumente werden automatisch erkannt.</p>
      </div>
      <div className="space-y-2">
        {outputs.map((item) => {
          const generated = metadata[item.type]
          const isCurrent = generated?.masterDataVersion === currentVersion
          return (
            <Link key={item.type} href={item.href(projectId)} className="flex min-h-16 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 transition hover:border-[#5CB800]/50 hover:bg-[#5CB800]/5">
              <span className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-[#1F2A44]"><FileText className="h-5 w-5" /></span>
                <span>
                  <span className="block text-sm font-bold text-[#1F2A44]">{item.label}</span>
                  <span className="block text-xs text-muted-foreground">{generated ? `Erstellt: ${dateLabel(generated.generatedAt)}` : 'Noch nicht erzeugt'}</span>
                </span>
              </span>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${isCurrent ? 'bg-emerald-50 text-emerald-700' : generated ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                {isCurrent ? <CheckCircle2 className="h-3.5 w-3.5" /> : generated ? <AlertTriangle className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
                {isCurrent ? 'Aktuell' : generated ? 'Veraltet' : 'Erstellen'}
              </span>
            </Link>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground">Aktuelle Projektversion: {currentVersion}</p>
    </div>
  )
}
