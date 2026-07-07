'use client'

import { useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createProject, updateProject } from '@/lib/actions/project.actions'
import { LoadingSpinner, DevStatusDot } from '@/components/ui'
import { cn } from '@/lib/utils'
import {
  PROJECT_STATUS_LABELS, PROJECT_STATUS_ORDER,
  PRIORITY_LABELS, MARKETING_STATUS_LABELS,
  PROJECT_TYPE_LABELS, GERMAN_STATES,
} from '@/lib/types/constants'
import type { Project, ProjectType, Partner } from '@/lib/types/database.types'

interface ProjectFormProps {
  project?: Project & { partner_name?: string | null; partner_company?: string | null }
  partners?: Partner[]
  mode: 'create' | 'edit'
}

type WizardStep = 'type' | 'general' | 'technical' | 'status' | 'review'

const STEPS: { key: WizardStep; label: string }[] = [
  { key: 'type',      label: 'Typ' },
  { key: 'general',   label: 'Allgemein' },
  { key: 'technical', label: 'Technik' },
  { key: 'status',    label: 'Status' },
  { key: 'review',    label: 'Übersicht' },
]

export function ProjectForm({ project, partners = [], mode }: ProjectFormProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [step, setStep] = useState<WizardStep>(mode === 'edit' ? 'general' : 'type')
  const [projectType, setProjectType] = useState<ProjectType>(project?.project_type ?? 'pv_freiflaeche')

  const stepIndex = STEPS.findIndex((s) => s.key === step)

  const showPvFields =
    projectType === 'pv_freiflaeche' ||
    projectType === 'pv_dach' ||
    projectType === 'hybrid'

  const showBessFields =
    projectType === 'bess' ||
    projectType === 'hybrid'

  const handleSubmit = async (formData: FormData) => {
    startTransition(async () => {
      try {
        const result = mode === 'create'
          ? await createProject(formData)
          : project
          ? await updateProject(project.id, formData)
          : { error: 'Projekt nicht gefunden' }

        if (result?.error) {
          toast.error(result.error)
        }
      } catch (err) {
        const error = err as Error
        if (!error.message?.includes('NEXT_REDIRECT')) {
          toast.error('Fehler beim Speichern')
        }
      }
    })
  }

  return (
    <form action={handleSubmit} className="space-y-0">
      <input type="hidden" name="project_type" value={projectType} />

      {mode === 'create' && (
        <div className="flex items-center gap-1.5 mb-6 overflow-x-auto no-scrollbar pb-1">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => i < stepIndex && setStep(s.key)}
                className={cn(
                  'flex items-center gap-1.5 text-xs font-medium transition-colors',
                  s.key === step
                    ? 'text-[#5CB800]'
                    : i < stepIndex
                    ? 'text-foreground cursor-pointer'
                    : 'text-muted-foreground cursor-default'
                )}
              >
                <span className={cn(
                  'w-5 h-5 rounded-full flex items-center justify-center text-2xs font-bold shrink-0',
                  s.key === step
                    ? 'bg-[#5CB800] text-white'
                    : i < stepIndex
                    ? 'bg-foreground text-background'
                    : 'bg-muted text-muted-foreground'
                )}>
                  {i < stepIndex ? '✓' : i + 1}
                </span>
                <span className="hidden sm:inline">{s.label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div className={cn('w-6 h-px', i < stepIndex ? 'bg-foreground' : 'bg-border')} />
              )}
            </div>
          ))}
        </div>
      )}

      <div className={mode === 'create' && step !== 'type' ? 'hidden' : 'space-y-3 mb-6'}>
        {mode === 'create' && <h2 className="text-base font-semibold text-foreground">Projekttyp wählen</h2>}

        <div className="grid grid-cols-1 gap-2">
          {(Object.entries(PROJECT_TYPE_LABELS) as [ProjectType, string][]).map(([type, label]) => {
            const icons: Record<ProjectType, string> = {
              pv_freiflaeche: '☀️',
              pv_dach:        '🏠',
              bess:           '🔋',
              hybrid:         '⚡',
              wind:           '💨',
            }
            return (
              <button
                key={type}
                type="button"
                onClick={() => setProjectType(type)}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg border text-left transition-all',
                  projectType === type
                    ? 'border-[#5CB800] bg-[#5CB800]/5 text-foreground'
                    : 'border-border bg-card text-muted-foreground hover:border-border/80 hover:text-foreground'
                )}
              >
                <span className="text-xl">{icons[type]}</span>
                <span className="font-medium text-sm">{label}</span>
                {projectType === type && <span className="ml-auto text-[#5CB800] text-sm">✓</span>}
              </button>
            )
          })}
        </div>

        {mode === 'create' && (
          <div className="pt-2">
            <button type="button" onClick={() => setStep('general')} className="btn-primary w-full">
              Weiter →
            </button>
          </div>
        )}
      </div>

      <div className={mode === 'create' && step !== 'general' ? 'hidden' : 'space-y-4 mb-6'}>
        {mode === 'create' && <h2 className="text-base font-semibold text-foreground">Allgemeine Daten</h2>}

        <div>
          <label className="form-label">Projektname *</label>
          <input
            name="project_name"
            type="text"
            required
            defaultValue={project?.project_name}
            placeholder="z. B. Solarpark Erfurt Süd"
            className="form-input"
          />
        </div>

        {partners.length > 0 && (
          <div>
            <label className="form-label">Partner</label>
            <select name="partner_id" className="form-input" defaultValue={project?.partner_id ?? ''}>
              <option value="">– Kein Partner –</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}{p.company ? ` · ${p.company}` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="form-label">Ansprechpartner</label>
            <input name="contact_name" type="text" defaultValue={project?.contact_name ?? ''} placeholder="Name" className="form-input" />
          </div>
          <div>
            <label className="form-label">E-Mail</label>
            <input name="contact_email" type="email" defaultValue={project?.contact_email ?? ''} placeholder="email@beispiel.de" className="form-input" />
          </div>
        </div>

        <div>
          <label className="form-label">Telefon</label>
          <input name="contact_phone" type="tel" defaultValue={project?.contact_phone ?? ''} placeholder="+49 89 ..." className="form-input" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label">Ort</label>
            <input name="location_city" type="text" defaultValue={project?.location_city ?? ''} placeholder="Stadt" className="form-input" />
          </div>
          <div>
            <label className="form-label">Bundesland</label>
            <select name="location_state" className="form-input" defaultValue={project?.location_state ?? ''}>
              <option value="">– wählen –</option>
              {GERMAN_STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="form-label">Notizen</label>
          <textarea name="notes" rows={3} defaultValue={project?.notes ?? ''} placeholder="Interne Notizen zum Projekt..." className="form-input resize-none" />
        </div>

        {mode === 'create' && (
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={() => setStep('type')} className="btn-secondary flex-1">← Zurück</button>
            <button type="button" onClick={() => setStep('technical')} className="btn-primary flex-1">Weiter →</button>
          </div>
        )}
      </div>

      <div className={mode === 'create' && step !== 'technical' ? 'hidden' : 'space-y-4 mb-6'}>
        {mode === 'create' && <h2 className="text-base font-semibold text-foreground">Technische Daten</h2>}

        {showPvFields && (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">PV</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">Leistung</label>
                <div className="relative">
                  <input name="pv_mwp" type="number" step="0.001" min="0" defaultValue={project?.pv_mwp ?? undefined} placeholder="0" className="form-input pr-12" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">kWp</span>
                </div>
              </div>
              <div>
                <label className="form-label">AC-Leistung</label>
                <div className="relative">
                  <input name="pv_ac_mw" type="number" step="0.001" min="0" defaultValue={project?.pv_ac_mw ?? undefined} placeholder="0" className="form-input pr-10" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">kW</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {showBessFields && (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">BESS</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="form-label">Leistung</label>
                <div className="relative">
                  <input name="bess_mw" type="number" step="0.1" min="0" defaultValue={project?.bess_mw ?? undefined} placeholder="0" className="form-input pr-10" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">MW</span>
                </div>
              </div>
              <div>
                <label className="form-label">Energie</label>
                <div className="relative">
                  <input name="bess_mwh" type="number" step="0.1" min="0" defaultValue={project?.bess_mwh ?? undefined} placeholder="0" className="form-input pr-12" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">MWh</span>
                </div>
              </div>
              <div>
                <label className="form-label">Dauer</label>
                <div className="relative">
                  <input name="bess_dur" type="number" step="0.5" min="0" defaultValue={project?.bess_duration_h ?? undefined} placeholder="4" className="form-input pr-5" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">h</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Entwicklungsstand</p>
          {[
            { key: 'dev_netzanschluss', label: 'Netzanschluss', field: 'netzanschluss' },
            { key: 'dev_baugenehmigung', label: 'Baugenehmigung', field: 'baugenehmigung' },
            { key: 'dev_pachtvertrag', label: 'Pachtvertrag', field: 'pachtvertrag' },
            { key: 'dev_eeg', label: 'EEG-Fähigkeit', field: 'eeg_faehigkeit' },
            { key: 'dev_gutachten', label: 'Gutachten', field: 'gutachten' },
            { key: 'dev_umwelt', label: 'Umweltprüfung', field: 'umweltpruefung' },
          ].map(({ key, label, field }) => {
            const currentVal = project?.dev_status?.[field as keyof typeof project.dev_status]
            return (
              <div key={key} className="flex items-center justify-between py-1.5">
                <span className="text-sm text-foreground">{label}</span>
                <DevStatusTriToggle name={key} defaultValue={currentVal} />
              </div>
            )
          })}
        </div>

        {mode === 'create' && (
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={() => setStep('general')} className="btn-secondary flex-1">← Zurück</button>
            <button type="button" onClick={() => setStep('status')} className="btn-primary flex-1">Weiter →</button>
          </div>
        )}
      </div>

      <div className={mode === 'create' && step !== 'status' ? 'hidden' : 'space-y-4 mb-6'}>
        {mode === 'create' && <h2 className="text-base font-semibold text-foreground">Status & Priorität</h2>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="form-label">Projektstatus</label>
            <select name="status" className="form-input" defaultValue={project?.status ?? 'lead'}>
              {PROJECT_STATUS_ORDER.map((s) => (
                <option key={s} value={s}>{PROJECT_STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Priorität</label>
            <select name="priority" className="form-input" defaultValue={project?.priority ?? 'mittel'}>
              {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="form-label">Vermarktungsstatus</label>
          <select name="marketing_status" className="form-input" defaultValue={project?.marketing_status ?? 'nicht_gestartet'}>
            {Object.entries(MARKETING_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        {mode === 'create' && (
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={() => setStep('technical')} className="btn-secondary flex-1">← Zurück</button>
            <button type="button" onClick={() => setStep('review')} className="btn-primary flex-1">Weiter →</button>
          </div>
        )}
      </div>

      <div className={mode === 'create' && step !== 'review' ? 'hidden' : 'space-y-4'}>
        {mode === 'create' && (
          <>
            <h2 className="text-base font-semibold text-foreground">Übersicht</h2>
            <p className="text-sm text-muted-foreground">
              Typ: <strong>{PROJECT_TYPE_LABELS[projectType]}</strong> – Projektnummer wird automatisch vergeben.
            </p>
          </>
        )}

        <div className="flex gap-2">
          {mode === 'create' && (
            <button type="button" onClick={() => setStep('status')} className="btn-secondary">← Zurück</button>
          )}
          {mode === 'edit' && (
            <button type="button" onClick={() => router.back()} className="btn-secondary">Abbrechen</button>
          )}
          <button type="submit" disabled={pending} className="btn-primary flex-1 sm:flex-none">
            {pending
              ? <><LoadingSpinner size="sm" /> Speichern…</>
              : mode === 'create'
              ? '✓ Projekt erstellen'
              : '✓ Änderungen speichern'}
          </button>
        </div>
      </div>
    </form>
  )
}

function DevStatusTriToggle({
  name,
  defaultValue,
}: {
  name: string
  defaultValue?: boolean | null
}) {
  const [value, setValue] = useState<boolean | null>(defaultValue ?? null)

  const cycle = () => {
    setValue((v) => v === null ? true : v === true ? false : null)
  }

  const label   = value === true ? '✅' : value === false ? '❌' : '⚪'
  const bgColor = value === true
    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
    : value === false
    ? 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'
    : 'bg-muted border-border text-muted-foreground'

  return (
    <>
      <input type="hidden" name={name} value={value === null ? '' : String(value)} />
      <button
        type="button"
        onClick={cycle}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium transition-all',
          bgColor
        )}
      >
        <span>{label}</span>
        <span>{value === true ? 'Ja' : value === false ? 'Nein' : 'Offen'}</span>
      </button>
    </>
  )
}
