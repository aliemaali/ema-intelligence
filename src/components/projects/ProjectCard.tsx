'use client'

import Link from 'next/link'
import { MapPin, Zap, Calendar } from 'lucide-react'
import { StatusBadge, TypeBadge, PriorityBadge } from '@/components/ui'
import { formatCurrency, formatMW, formatRelativeTime } from '@/lib/utils'
import type { ProjectWithDeal } from '@/lib/types/database.types'

interface ProjectCardProps {
  project: ProjectWithDeal
}




function getAiScoreRating(score: number | null | undefined) {
  if (score == null) {
    return {
      label: 'Keine Analyse',
      className: 'bg-muted text-muted-foreground border-border',
      dotClassName: 'bg-muted-foreground',
    }
  }

  if (score >= 70) {
    return {
      label: 'Hoch',
      className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      dotClassName: 'bg-emerald-500',
    }
  }

  if (score >= 40) {
    return {
      label: 'Mittel',
      className: 'bg-amber-50 text-amber-700 border-amber-200',
      dotClassName: 'bg-amber-500',
    }
  }

  return {
    label: 'Niedrig',
    className: 'bg-red-50 text-red-700 border-red-200',
    dotClassName: 'bg-red-500',
  }
}

function AiScoreBadge({ score }: { score: number | null | undefined }) {
  const rating = getAiScoreRating(score)

  return (
    <div
      className="flex items-center gap-2"
      title={score == null ? 'Noch keine KI-Analyse vorhanden' : `AI Score: ${score}/100`}
    >
      <span className={`w-2.5 h-2.5 rounded-full ${rating.dotClassName}`} />
      <span className="text-sm font-medium">
        {rating.label}
      </span>
    </div>
  )
}

export function ProjectCard({ project }: ProjectCardProps) {
  const hasNetProfit = project.deal_net_profit !== null && project.deal_net_profit !== undefined
  const aiScore = project.ai_score

  // Build tech summary string
  const techSummary = (() => {
    if (project.project_type === 'bess') {
      const parts = []
      if (project.bess_mw)  parts.push(formatMW(project.bess_mw, 'MW'))
      if (project.bess_mwh) parts.push(formatMW(project.bess_mwh, 'MWh'))
      return parts.join(' / ')
    }
    if (project.pv_mwp) return formatMW(project.pv_mwp, 'kWp')
    return null
  })()

  return (
    <Link
      href={`/projects/${project.id}/overview`}
      className="card-padded block hover:border-[#5CB800]/40 transition-colors active:scale-[0.99]"
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-2xs font-mono text-muted-foreground">
              {project.project_number}
            </span>
            <TypeBadge type={project.project_type} />
          </div>
          <h3 className="font-semibold text-foreground text-sm leading-tight truncate">
            {project.project_name}
          </h3>
        </div>
        <StatusBadge status={project.status} />
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mb-3">
        {project.location_city && (
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {project.location_city}{project.location_state ? `, ${project.location_state}` : ''}
          </span>
        )}
        {techSummary && (
          <span className="flex items-center gap-1">
            <Zap className="w-3 h-3" />
            {techSummary}
          </span>
        )}
        {project.last_activity_at && (
          <span className="flex items-center gap-1 ml-auto">
            <Calendar className="w-3 h-3" />
            {formatRelativeTime(project.last_activity_at)}
          </span>
        )}
      </div>

      {/* Bottom row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PriorityBadge priority={project.priority} />
          {project.partner_name && (
            <span className="text-xs text-muted-foreground truncate max-w-[120px]">
              {project.partner_company ?? project.partner_name}
            </span>
          )}
        </div>

        <div className="text-right">
            <div className="text-[10px] text-muted-foreground uppercase mb-1">
              AI Score
            </div>
            <AiScoreBadge score={aiScore} />
          </div>

          {/* Deal Net Profit */}
        {hasNetProfit ? (
          <span className="text-sm font-semibold text-[#5CB800]">
            {formatCurrency(project.deal_net_profit)}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground italic">Kein Deal</span>
        )}
      </div>
    </Link>
  )
}

// ── Table Row for Desktop ─────────────────────────────────────────────────────

export function ProjectRow({ project }: ProjectCardProps) {
  const techSummary = (() => {
    if (project.project_type === 'bess') {
      const parts = []
      if (project.bess_mw)  parts.push(`${project.bess_mw} MW`)
      if (project.bess_mwh) parts.push(`${project.bess_mwh} MWh`)
      return parts.join(' / ')
    }
    if (project.pv_mwp) return `${project.pv_mwp} kWp`
    return '–'
  })()

  const aiScore = project.ai_score

  return (
    <tr className="border-b border-border hover:bg-muted/30 transition-colors">
      <td className="py-3 px-4">
        <Link href={`/projects/${project.id}/overview`} className="block">
          <div className="font-mono text-xs text-muted-foreground">{project.project_number}</div>
          <div className="font-medium text-sm text-foreground">{project.project_name}</div>
          {project.location_city && (
            <div className="text-xs text-muted-foreground">{project.location_city}</div>
          )}
        </Link>
      </td>
      <td className="py-3 px-4">
        <TypeBadge type={project.project_type} />
      </td>
      <td className="py-3 px-4 text-sm text-muted-foreground">{techSummary}</td>
      <td className="py-3 px-4">
        <StatusBadge status={project.status} />
      </td>
      <td className="py-3 px-4">
        <PriorityBadge priority={project.priority} />
      </td>
      <td className="py-3 px-4 text-right">
        <AiScoreBadge score={aiScore} />
      </td>
      <td className="py-3 px-4 text-right">
        {project.deal_net_profit !== null ? (
          <span className="text-sm font-semibold text-[#5CB800]">
            {formatCurrency(project.deal_net_profit)}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">–</span>
        )}
      </td>
      <td className="py-3 px-4 text-right">
        <Link
          href={`/projects/${project.id}/overview`}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Details →
        </Link>
      </td>
    </tr>
  )
}
