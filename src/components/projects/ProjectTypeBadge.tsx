import {
  BatteryCharging,
  FolderKanban,
  Layers,
  PanelsTopLeft,
  Server,
  Wind,
  type LucideIcon,
} from 'lucide-react'

type ProjectTypeConfig = {
  label: string
  icon: LucideIcon
  className: string
}

const projectTypeConfig: Record<string, ProjectTypeConfig> = {
  pv_freiflaeche: {
    label: 'PV-Freifläche',
    icon: PanelsTopLeft,
    className: 'border-amber-200 bg-amber-50 text-amber-700',
  },
  pv_dach: {
    label: 'PV-Dach',
    icon: PanelsTopLeft,
    className: 'border-amber-200 bg-amber-50 text-amber-700',
  },
  bess: {
    label: 'BESS',
    icon: BatteryCharging,
    className: 'border-blue-200 bg-blue-50 text-blue-700',
  },
  hybrid: {
    label: 'Hybrid',
    icon: Layers,
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  rechenzentrum: {
    label: 'Rechenzentrum',
    icon: Server,
    className: 'border-violet-200 bg-violet-50 text-violet-700',
  },
  wind: {
    label: 'Wind',
    icon: Wind,
    className: 'border-sky-200 bg-sky-50 text-sky-700',
  },
  sonstiges: {
    label: 'Sonstiges',
    icon: FolderKanban,
    className: 'border-slate-200 bg-slate-50 text-slate-600',
  },
}

const fallbackConfig: ProjectTypeConfig = {
  label: 'Projekt',
  icon: FolderKanban,
  className: 'border-slate-200 bg-slate-50 text-slate-600',
}

export function ProjectTypeBadge({ type, overlay = false }: { type?: string | null; overlay?: boolean }) {
  const config = projectTypeConfig[type ?? ''] ?? fallbackConfig
  const Icon = config.icon

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-wide ${
        overlay ? 'border-white/70 bg-white/95 text-[#07142F] shadow-sm' : config.className
      }`}
      title={`Projekttyp: ${config.label}`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      <span>{config.label}</span>
    </span>
  )
}
