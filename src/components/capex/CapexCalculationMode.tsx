'use client'

import { Building2, Hammer, KeyRound } from 'lucide-react'
import {
  CAPEX_CALCULATION_MODE_LABELS,
  type CapexCalculationMode,
  type CapexProject,
  type ProjectOption,
} from '@/lib/types/capex.types'
import { eur, eurKwp } from '@/lib/capex/format'
import { Field, InfoLine, NumInput } from './FormControls'

interface Props {
  project: CapexProject
  projectOption: ProjectOption
  onChange: <K extends keyof CapexProject>(key: K, value: CapexProject[K]) => void
}

const options = [
  {
    mode: 'turnkey' as const,
    icon: Building2,
    description: 'Der vollständige Anlagenkaufpreis bildet den CAPEX. Komponenten werden nicht doppelt addiert.',
  },
  {
    mode: 'epc' as const,
    icon: Hammer,
    description: 'Module, Wechselrichter, Unterkonstruktion, Montage und weitere Baukosten werden addiert.',
  },
  {
    mode: 'project_rights_epc' as const,
    icon: KeyRound,
    description: 'Kauf der Projektrechte plus die vollständige EPC- und Komponenten-Kalkulation.',
  },
]

export function CapexCalculationModeSelector({ project, projectOption, onChange }: Props) {
  const acquisition = project.componentPricing.acquisition
  const dealPurchasePrice = Number(projectOption.purchase_price) || 0

  function selectMode(mode: Exclude<CapexCalculationMode, ''>) {
    onChange('componentPricing', {
      ...project.componentPricing,
      acquisition: {
        ...acquisition,
        mode,
        turnkeyPurchasePrice: mode === 'turnkey'
          ? acquisition.turnkeyPurchasePrice || dealPurchasePrice
          : acquisition.turnkeyPurchasePrice,
      },
    })
  }

  function setTurnkeyPurchasePrice(value: number) {
    onChange('componentPricing', {
      ...project.componentPricing,
      acquisition: {
        ...acquisition,
        turnkeyPurchasePrice: Math.max(0, value || 0),
      },
    })
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 md:grid-cols-3">
        {options.map(({ mode, icon: Icon, description }) => {
          const selected = acquisition.mode === mode
          return (
            <button
              key={mode}
              type="button"
              onClick={() => selectMode(mode)}
              aria-pressed={selected}
              className={`rounded-2xl border p-4 text-left transition ${
                selected
                  ? 'border-[#5CB800] bg-[#eef8e6] shadow-sm'
                  : 'border-slate-200 bg-white hover:border-[#5CB800]/50'
              }`}
            >
              <span className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${
                selected ? 'bg-[#5CB800] text-white' : 'bg-slate-100 text-[#1F2A44]'
              }`}>
                <Icon className="h-5 w-5" />
              </span>
              <span className="block text-sm font-extrabold text-[#1F2A44]">
                {CAPEX_CALCULATION_MODE_LABELS[mode]}
              </span>
              <span className="mt-1.5 block text-xs leading-5 text-slate-500">{description}</span>
            </button>
          )
        })}
      </div>

      {!acquisition.mode && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-bold leading-5 text-amber-800">
          Bitte zuerst die Kalkulationsart auswählen. Erst danach wird der Gesamt-CAPEX berechnet.
        </div>
      )}

      {acquisition.mode === 'turnkey' && (
        <div className="rounded-2xl border border-[#5CB800]/30 bg-white p-3">
          <Field label="Kaufpreis der schlüsselfertigen Anlage (€)">
            <NumInput
              value={acquisition.turnkeyPurchasePrice}
              onChange={(value) => setTurnkeyPurchasePrice(Number(value))}
              step="0.01"
              suffix="€"
            />
          </Field>
          {dealPurchasePrice > 0 && (
            <InfoLine>
              Im Deal gespeichert: <strong>{eur(dealPurchasePrice)}</strong>
              {project.anlagenleistungKwp > 0 && (
                <> · <strong>{eurKwp(dealPurchasePrice / project.anlagenleistungKwp)}</strong></>
              )}
            </InfoLine>
          )}
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Komponentenpreise bleiben als interne Plausibilitätsprüfung sichtbar, fließen aber nicht
            zusätzlich in den Gesamt-CAPEX ein.
          </p>
        </div>
      )}
    </div>
  )
}
