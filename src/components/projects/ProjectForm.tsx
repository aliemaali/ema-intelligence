'use client'

import { useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createProject, updateProject } from '@/lib/actions/project.actions'
import { LoadingSpinner } from '@/components/ui'
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
  { key: 'type', label: 'Typ' },
  { key: 'general', label: 'Allgemein' },
  { key: 'technical', label: 'Technik' },
  { key: 'status', label: 'Status' },
  { key: 'review', label: 'Übersicht' },
]

export function ProjectForm({ project, partners = [], mode }: ProjectFormProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [step, setStep] = useState<WizardStep>(mode === 'edit' ? 'general' : 'type')
  const [projectType, setProjectType] = useState<ProjectType>(project?.project_type ?? 'pv_freiflaeche')
  const projectData = project as any

  const stepIndex = STEPS.findIndex((item) => item.key === step)
  const showPvFields = ['pv_freiflaeche', 'pv_dach', 'hybrid'].includes(projectType)
  const showBessFields = ['bess', 'hybrid'].includes(projectType)
  const showDataCenterFields = projectType === 'rechenzentrum'
  const showDevelopmentChecklist = projectType !== 'sonstiges'

  const handleSubmit = async (formData: FormData) => {
    startTransition(async () => {
      try {
        const result = mode === 'create'
          ? await createProject(formData)
          : project
            ? await updateProject(project.id, formData)
            : { error: 'Projekt nicht gefunden' }

        if (result?.error) toast.error(result.error)
      } catch (error) {
        const current = error as Error
        if (!current.message?.includes('NEXT_REDIRECT')) toast.error('Fehler beim Speichern')
      }
    })
  }

  return (
    <form action={handleSubmit} className="space-y-0">
      <input type="hidden" name="project_type" value={projectType} />

      {mode === 'create' && (
        <div className="mb-6 flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {STEPS.map((item, index) => (
            <div key={item.key} className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => index < stepIndex && setStep(item.key)}
                className={cn(
                  'flex items-center gap-1.5 text-xs font-medium transition-colors',
                  item.key === step
                    ? 'text-[#5CB800]'
                    : index < stepIndex
                      ? 'cursor-pointer text-foreground'
                      : 'cursor-default text-muted-foreground',
                )}
              >
                <span className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-2xs font-bold',
                  item.key === step
                    ? 'bg-[#5CB800] text-white'
                    : index < stepIndex
                      ? 'bg-foreground text-background'
                      : 'bg-muted text-muted-foreground',
                )}>
                  {index < stepIndex ? '✓' : index + 1}
                </span>
                <span className="hidden sm:inline">{item.label}</span>
              </button>
              {index < STEPS.length - 1 && <div className={cn('h-px w-6', index < stepIndex ? 'bg-foreground' : 'bg-border')} />}
            </div>
          ))}
        </div>
      )}

      <div className={mode === 'create' && step !== 'type' ? 'hidden' : 'mb-6 space-y-3'}>
        {mode === 'create' && <h2 className="text-base font-semibold text-foreground">Projekttyp wählen</h2>}
        <div className="grid grid-cols-1 gap-2">
          {(Object.entries(PROJECT_TYPE_LABELS) as [ProjectType, string][]).map(([type, label]) => {
            const icons: Record<ProjectType, string> = {
              pv_freiflaeche: '☀️',
              pv_dach: '🏠',
              bess: '🔋',
              hybrid: '⚡',
              wind: '💨',
              rechenzentrum: '🖥️',
              sonstiges: '📁',
            }
            return (
              <button
                key={type}
                type="button"
                onClick={() => setProjectType(type)}
                className={cn(
                  'flex items-center gap-3 rounded-lg border p-3 text-left transition-all',
                  projectType === type
                    ? 'border-[#5CB800] bg-[#5CB800]/5 text-foreground'
                    : 'border-border bg-card text-muted-foreground hover:text-foreground',
                )}
              >
                <span className="text-xl">{icons[type]}</span>
                <span className="text-sm font-medium">{label}</span>
                {projectType === type && <span className="ml-auto text-sm text-[#5CB800]">✓</span>}
              </button>
            )
          })}
        </div>
        {mode === 'create' && <button type="button" onClick={() => setStep('general')} className="btn-primary w-full">Weiter →</button>}
      </div>

      <div className={mode === 'create' && step !== 'general' ? 'hidden' : 'mb-6 space-y-4'}>
        {mode === 'create' && <h2 className="text-base font-semibold text-foreground">Allgemeine Daten</h2>}
        <div>
          <label className="form-label">Projektname *</label>
          <input name="project_name" required defaultValue={project?.project_name} placeholder="Projektname" className="form-input" />
        </div>

        {partners.length > 0 && (
          <div>
            <label className="form-label">Partner</label>
            <select name="partner_id" className="form-input" defaultValue={project?.partner_id ?? ''}>
              <option value="">– Kein Partner –</option>
              {partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.full_name}{partner.company ? ` · ${partner.company}` : ''}</option>)}
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div><label className="form-label">Ansprechpartner</label><input name="contact_name" defaultValue={project?.contact_name ?? ''} className="form-input" /></div>
          <div><label className="form-label">E-Mail</label><input name="contact_email" type="email" defaultValue={project?.contact_email ?? ''} className="form-input" /></div>
        </div>
        <div><label className="form-label">Telefon</label><input name="contact_phone" type="tel" defaultValue={project?.contact_phone ?? ''} className="form-input" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="form-label">Ort</label><input name="location_city" defaultValue={project?.location_city ?? ''} className="form-input" /></div>
          <div>
            <label className="form-label">Bundesland</label>
            <select name="location_state" className="form-input" defaultValue={project?.location_state ?? ''}>
              <option value="">– wählen –</option>
              {GERMAN_STATES.map((state) => <option key={state} value={state}>{state}</option>)}
            </select>
          </div>
        </div>
        <UnitField label="Investitionsvolumen" name="investment_volume_eur" unit="€" step="1" defaultValue={projectData?.investment_volume_eur} />
        <div><label className="form-label">Notizen</label><textarea name="notes" rows={3} defaultValue={project?.notes ?? ''} className="form-input resize-none" /></div>
        {mode === 'create' && <div className="flex gap-2"><button type="button" onClick={() => setStep('type')} className="btn-secondary flex-1">← Zurück</button><button type="button" onClick={() => setStep('technical')} className="btn-primary flex-1">Weiter →</button></div>}
      </div>

      <div className={mode === 'create' && step !== 'technical' ? 'hidden' : 'mb-6 space-y-4'}>
        {mode === 'create' && <h2 className="text-base font-semibold text-foreground">Technische Daten</h2>}

        {showPvFields && (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">PV</p>
            <div className="grid grid-cols-2 gap-3">
              <UnitField label="Leistung" name="pv_mwp" unit="kWp" step="0.001" defaultValue={project?.pv_mwp} />
              <UnitField label="AC-Leistung" name="pv_ac_mw" unit="kW" step="0.001" defaultValue={project?.pv_ac_mw} />
            </div>
          </div>
        )}

        {showBessFields && (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">BESS</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <UnitField label="Leistung" name="bess_mw" unit="MW" step="0.1" defaultValue={project?.bess_mw} />
              <UnitField label="Energie" name="bess_mwh" unit="MWh" step="0.1" defaultValue={project?.bess_mwh} />
              <UnitField label="Dauer" name="bess_dur" unit="h" step="0.5" defaultValue={project?.bess_duration_h} />
            </div>
          </div>
        )}

        {showDataCenterFields && (
          <div className="space-y-3 rounded-2xl border border-border p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rechenzentrum</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <UnitField label="Netzanschlussleistung" name="data_center_grid_mw" unit="MW" step="0.1" defaultValue={projectData?.data_center_grid_mw} />
              <UnitField label="IT-Leistung" name="data_center_it_mw" unit="MW" step="0.1" defaultValue={projectData?.data_center_it_mw} />
              <UnitField label="Grundstücksfläche" name="land_area_sqm" unit="m²" step="1" defaultValue={projectData?.land_area_sqm} />
              <div><label className="form-label">Transformator / Umspannwerk</label><input name="transformer_status" defaultValue={projectData?.transformer_status ?? ''} placeholder="z. B. gesichert, geplant, offen" className="form-input" /></div>
            </div>
            <div>
              <label className="form-label">Rechenzentrum-Status</label>
              <select name="data_center_status" className="form-input" defaultValue={projectData?.data_center_status ?? 'in_entwicklung'}>
                <option value="in_entwicklung">In Entwicklung</option>
                <option value="rtb">RTB – Ready to Build</option>
              </select>
            </div>
          </div>
        )}

        {projectType === 'sonstiges' && (
          <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            Für sonstige Projekte werden nur die allgemeinen Angaben, Notizen, das Investitionsvolumen und Dokumente verwendet.
          </div>
        )}

        {showDevelopmentChecklist && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Entwicklungsstand</p>
            {[
              { key: 'dev_netzanschluss', label: 'Netzanschluss', field: 'netzanschluss' },
              { key: 'dev_baugenehmigung', label: 'Baugenehmigung', field: 'baugenehmigung' },
              { key: 'dev_pachtvertrag', label: 'Pachtvertrag', field: 'pachtvertrag' },
              { key: 'dev_eeg', label: 'EEG-Fähigkeit', field: 'eeg_faehigkeit' },
              { key: 'dev_gutachten', label: 'Gutachten', field: 'gutachten' },
              { key: 'dev_umwelt', label: 'Umweltprüfung', field: 'umweltpruefung' },
            ].map(({ key, label, field }) => (
              <div key={key} className="flex items-center justify-between py-1.5">
                <span className="text-sm text-foreground">{label}</span>
                <DevStatusTriToggle name={key} defaultValue={project?.dev_status?.[field as keyof typeof project.dev_status]} />
              </div>
            ))}
          </div>
        )}

        {mode === 'create' && <div className="flex gap-2"><button type="button" onClick={() => setStep('general')} className="btn-secondary flex-1">← Zurück</button><button type="button" onClick={() => setStep('status')} className="btn-primary flex-1">Weiter →</button></div>}
      </div>

      <div className={mode === 'create' && step !== 'status' ? 'hidden' : 'mb-6 space-y-4'}>
        {mode === 'create' && <h2 className="text-base font-semibold text-foreground">Status & Priorität</h2>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div><label className="form-label">Projektstatus</label><select name="status" className="form-input" defaultValue={project?.status ?? 'lead'}>{PROJECT_STATUS_ORDER.map((status) => <option key={status} value={status}>{PROJECT_STATUS_LABELS[status]}</option>)}</select></div>
          <div><label className="form-label">Priorität</label><select name="priority" className="form-input" defaultValue={project?.priority ?? 'mittel'}>{Object.entries(PRIORITY_LABELS).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></div>
        </div>
        <div><label className="form-label">Vermarktungsstatus</label><select name="marketing_status" className="form-input" defaultValue={project?.marketing_status ?? 'nicht_gestartet'}>{Object.entries(MARKETING_STATUS_LABELS).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></div>
        {mode === 'create' && <div className="flex gap-2"><button type="button" onClick={() => setStep('technical')} className="btn-secondary flex-1">← Zurück</button><button type="button" onClick={() => setStep('review')} className="btn-primary flex-1">Weiter →</button></div>}
      </div>

      <div className={mode === 'create' && step !== 'review' ? 'hidden' : 'space-y-4'}>
        {mode === 'create' && <><h2 className="text-base font-semibold text-foreground">Übersicht</h2><p className="text-sm text-muted-foreground">Typ: <strong>{PROJECT_TYPE_LABELS[projectType]}</strong> – Projektnummer wird automatisch vergeben.</p></>}
        <div className="flex gap-2">
          {mode === 'create' && <button type="button" onClick={() => setStep('status')} className="btn-secondary">← Zurück</button>}
          {mode === 'edit' && <button type="button" onClick={() => router.back()} className="btn-secondary">Abbrechen</button>}
          <button type="submit" disabled={pending} className="btn-primary flex-1 sm:flex-none">{pending ? <><LoadingSpinner size="sm" /> Speichern…</> : mode === 'create' ? '✓ Projekt erstellen' : '✓ Änderungen speichern'}</button>
        </div>
      </div>
    </form>
  )
}

function UnitField({ label, name, unit, step, defaultValue }: { label: string; name: string; unit: string; step: string; defaultValue?: number | null }) {
  return <div><label className="form-label">{label}</label><div className="relative"><input name={name} type="number" step={step} min="0" defaultValue={defaultValue ?? undefined} className="form-input pr-14" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{unit}</span></div></div>
}

function DevStatusTriToggle({ name, defaultValue }: { name: string; defaultValue?: boolean | null }) {
  const [value, setValue] = useState<boolean | null>(defaultValue ?? null)
  const bgColor = value === true
    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600'
    : value === false
      ? 'bg-red-500/10 border-red-500/30 text-red-600'
      : 'bg-muted border-border text-muted-foreground'

  return (
    <>
      <input type="hidden" name={name} value={value === null ? '' : String(value)} />
      <button type="button" onClick={() => setValue((current) => current === null ? true : current === true ? false : null)} className={cn('flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium', bgColor)}>
        <span>{value === true ? '✅' : value === false ? '❌' : '⚪'}</span>
        <span>{value === true ? 'Ja' : value === false ? 'Nein' : 'Offen'}</span>
      </button>
    </>
  )
}
