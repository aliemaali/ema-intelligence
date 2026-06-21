import { cn } from '@/lib/utils'
import {
  MARKETING_RECOMMENDATION_LABELS, RISK_SEVERITY_LABELS,
} from '@/lib/types/analysis.types'
import type { GeneratedAnalysis, RiskSeverity } from '@/lib/types/analysis.types'

interface AnalysisPreviewProps {
  analysis: GeneratedAnalysis
}

const SEVERITY_STYLES: Record<RiskSeverity, { bg: string; text: string; dot: string }> = {
  hoch:    { bg: 'bg-red-50',    text: 'text-red-700',    dot: 'bg-red-500' },
  mittel:  { bg: 'bg-amber-50',  text: 'text-amber-700',  dot: 'bg-amber-500' },
  niedrig: { bg: 'bg-slate-50',  text: 'text-slate-600',  dot: 'bg-slate-400' },
}

const RECOMMENDATION_STYLES: Record<string, { bg: string; text: string }> = {
  bereit_zur_vermarktung:       { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  unterlagen_vervollstaendigen: { bg: 'bg-amber-50',   text: 'text-amber-700' },
  entwicklung_fortsetzen:       { bg: 'bg-blue-50',    text: 'text-blue-700' },
  nicht_vermarktungsfaehig:     { bg: 'bg-red-50',     text: 'text-red-700' },
}

export function AnalysisPreview({ analysis }: AnalysisPreviewProps) {
  const recStyle = RECOMMENDATION_STYLES[analysis.marketingRecommendation]

  return (
    <div className="space-y-5">

      {/* ── Gesamtscore ──────────────────────────────────────────────────── */}
      <div className="card-padded">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Gesamtscore
          </h3>
          <span className="text-xs text-muted-foreground">
            {new Date(analysis.analyzedAt).toLocaleString('de-DE')}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative w-20 h-20 shrink-0">
            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted" />
              <circle
                cx="40" cy="40" r="34" fill="none" stroke="#5CB800" strokeWidth="8"
                strokeDasharray={`${(analysis.overallScore / 100) * 213.6} 213.6`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xl font-bold text-foreground">{analysis.overallScore}</span>
            </div>
          </div>
          <div className="flex-1">
            <span className={cn('badge', recStyle?.bg, recStyle?.text, 'mb-2')}>
              {MARKETING_RECOMMENDATION_LABELS[analysis.marketingRecommendation]}
            </span>
            <ul className="space-y-1 mt-2">
              {analysis.marketingReasoning.map((reason, i) => (
                <li key={i} className="text-xs text-muted-foreground">{reason}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
<div className="grid grid-cols-2 md:grid-cols-4 gap-3">

  <div className="card-padded text-center">
    <p className="text-xs text-muted-foreground mb-1">DD Readiness</p>
    <p className="text-2xl font-bold text-[#5CB800]">
      {analysis.devStatusScore.percent}%
    </p>
  </div>

  <div className="card-padded text-center">
    <p className="text-xs text-muted-foreground mb-1">Vermarktung</p>
    <p className="text-sm font-semibold">
      {MARKETING_RECOMMENDATION_LABELS[analysis.marketingRecommendation]}
    </p>
  </div>

  <div className="card-padded text-center">
    <p className="text-xs text-muted-foreground mb-1">Investor Match</p>
    <p className="text-2xl font-bold text-[#5CB800]">
      {analysis.investorFit?.length ?? 0}
    </p>
  </div>

  <div className="card-padded text-center">
    <p className="text-xs text-muted-foreground mb-1">Risiken</p>
    <p className="text-2xl font-bold text-amber-500">
      {analysis.risks.length}
    </p>
  </div>

</div>

      {/* ── 1. Entwicklungsstand ─────────────────────────────────────────── */}
      <div className="card-padded">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Entwicklungsstand-Bewertung
        </h3>
        <div className="w-full h-2 bg-muted rounded-full mb-3 overflow-hidden">
          <div
            className="h-full bg-[#5CB800] rounded-full transition-all"
            style={{ width: `${analysis.devStatusScore.percent}%` }}
          />
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-lg font-bold text-emerald-600">{analysis.devStatusScore.completed}</p>
            <p className="text-2xs text-muted-foreground">Erfüllt</p>
          </div>
          <div>
            <p className="text-lg font-bold text-red-600">{analysis.devStatusScore.failed}</p>
            <p className="text-2xs text-muted-foreground">Nicht erfüllt</p>
          </div>
          <div>
            <p className="text-lg font-bold text-muted-foreground">{analysis.devStatusScore.open}</p>
            <p className="text-2xs text-muted-foreground">Offen</p>
          </div>
        </div>
      </div>

      {/* ── 2. Fehlende Unterlagen ───────────────────────────────────────── */}
      <div className="card-padded">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Fehlende Unterlagen
        </h3>
        {analysis.missingDocuments.length === 0 ? (
          <p className="text-sm text-emerald-600 flex items-center gap-1.5">
            <span>✓</span> Alle Kerndokumente vorhanden
          </p>
        ) : (
          <ul className="space-y-1.5">
            {analysis.missingDocuments.map((doc) => (
              <li key={doc.type} className="text-sm text-foreground flex items-center gap-1.5">
                <span className="text-amber-500">○</span> {doc.label}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── 3. Risikoanalyse ─────────────────────────────────────────────── */}
      <div className="card-padded">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Risikoanalyse
        </h3>
        {analysis.risks.length === 0 ? (
          <p className="text-sm text-emerald-600 flex items-center gap-1.5">
            <span>✓</span> Keine Risiken identifiziert
          </p>
        ) : (
          <div className="space-y-2">
            {analysis.risks.map((risk, i) => {
              const style = SEVERITY_STYLES[risk.severity]
              return (
                <div key={i} className={cn('rounded-lg p-3', style.bg)}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn('w-2 h-2 rounded-full shrink-0', style.dot)} />
                    <span className={cn('text-xs font-semibold uppercase', style.text)}>
                      {RISK_SEVERITY_LABELS[risk.severity]}
                    </span>
                    <span className="text-sm font-medium text-foreground">{risk.title}</span>
                  </div>
                  <p className="text-xs text-muted-foreground ml-4">{risk.description}</p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── 4. Investoren-Eignung ────────────────────────────────────────── */}
      <div className="card-padded">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Investoren-Eignung
        </h3>
        {analysis.hasNoLinkedInvestors ? (
          <p className="text-sm text-muted-foreground italic">
            Keine Investoren mit diesem Projekt verknüpft.
          </p>
        ) : (
          <div className="space-y-2">
            {analysis.investorFit.map((fit) => (
              <div key={fit.investorId} className="flex items-center justify-between gap-3 py-2 border-b border-border last:border-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{fit.name}</p>
                  <p className="text-xs text-muted-foreground">{fit.reasoning.join(' ')}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#5CB800] rounded-full"
                      style={{ width: `${fit.matchScore}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-[#5CB800] w-8 text-right">
                    {fit.matchScore}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 5. Vermarktungsempfehlung ────────────────────────────────────── */}
      <div className={cn('card-padded border-2', recStyle?.bg, 'border-current', recStyle?.text)}>
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-2 opacity-70">
          Vermarktungsempfehlung
        </h3>
        <p className="text-base font-bold mb-2">
          {MARKETING_RECOMMENDATION_LABELS[analysis.marketingRecommendation]}
        </p>
        <ul className="space-y-1">
          {analysis.marketingReasoning.map((reason, i) => (
            <li key={i} className="text-sm opacity-90">{reason}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
