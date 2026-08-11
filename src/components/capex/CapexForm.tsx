// src/components/capex/CapexForm.tsx
'use client'

import type { CapexCalcResult, CapexProject, ProjectOption } from '@/lib/types/capex.types'
import { eur, eurKwp, pct, num } from '@/lib/capex/format'
import { INVESTOR_OPEX_ESCALATION_PCT } from '@/lib/capex/calculations'
import { CapexVisualDashboard } from './CapexVisualDashboard'
import { CapexComponentPricing } from './CapexComponentPricing'
import { CapexMountingPricing } from './CapexMountingPricing'
import { CapexCalculationModeSelector } from './CapexCalculationMode'
import {
  SectionHeader,
  Field,
  NumInput,
  TextInput,
  SelectInput,
  KpiCard,
  InfoLine,
} from './FormControls'

interface CapexFormProps {
  project: CapexProject
  calc: CapexCalcResult
  onChange: <K extends keyof CapexProject>(key: K, value: CapexProject[K]) => void
  onSave: () => void
  onNew: () => void
  saving?: boolean
  projectOption: ProjectOption
}

export function CapexForm({ project, projectOption, calc, onChange, onSave, onNew, saving }: CapexFormProps) {
  const set = onChange

  return (
    <>
      <SectionHeader>Kalkulationsart</SectionHeader>
      <CapexCalculationModeSelector
        project={project}
        projectOption={projectOption}
        onChange={onChange}
      />

      {/* KPI cards */}
      <div className="mt-3.5 flex flex-wrap gap-2">
        <KpiCard label="Gesamt-CAPEX" value={eur(calc.totalCapex)} />
        <KpiCard label="Spez. Kosten" value={eurKwp(calc.specificCapex)} />
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <KpiCard label="Projekt-IRR (20J)" value={pct(calc.irr)} accent="#5CB800" />
        <KpiCard
          label="Payback (diskontiert)"
          value={calc.dynPayback !== null ? num(calc.dynPayback, 1) + ' J.' : '–'}
        />
        <KpiCard label="NPV @ WACC" value={eur(calc.npv)} />
      </div>
      <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs leading-5 text-slate-600">
        <strong className="text-[#1F2A44]">Investor-Basis:</strong> Projekt-IRR vor Steuern und
        Finanzierung, diskontierter Payback, {INVESTOR_OPEX_ESCALATION_PCT.toLocaleString('de-DE')} %
        OPEX-Steigerung p.a., kein Restwert. Für EEG ist die Erlössteigerung mit 0 % anzusetzen.
      </div>
      <CapexVisualDashboard calc={calc} />

      {/* Projektparameter */}
      <SectionHeader>Projektparameter</SectionHeader>
      <Field label="Projektname">
        <TextInput value={project.projektname} onChange={(v) => set('projektname', v)} />
      </Field>
      <Field label="Anlagenleistung (kWp)">
        <NumInput value={project.anlagenleistungKwp} onChange={(v) => set('anlagenleistungKwp', Number(v))} suffix="kWp" />
      </Field>
      <Field label="Spezifischer Ertrag (kWh/kWp p.a.)">
        <NumInput value={project.spezErtragKwhKwp} onChange={(v) => set('spezErtragKwhKwp', Number(v))} suffix="kWh/kWp" />
      </Field>
      <Field label="Strompreis / Einspeisevergütung (€/kWh)">
        <NumInput value={project.strompreisEurKwh} onChange={(v) => set('strompreisEurKwh', Number(v))} step="0.0001" suffix="€/kWh" />
      </Field>
      <Field label="Jährliche Degradation Ertrag (%)">
        <NumInput value={project.degradationPct} onChange={(v) => set('degradationPct', Number(v))} step="0.1" max="99.9" suffix="%" />
      </Field>
      <Field label="Betriebskosten p.a. (% von CAPEX)">
        <NumInput value={project.betriebskostenPct} onChange={(v) => set('betriebskostenPct', Number(v))} step="0.1" suffix="%" />
      </Field>
      <Field label="Pachtdauer (Jahre)">
        <NumInput value={project.pachtdauerJahre} onChange={(v) => set('pachtdauerJahre', Number(v))} suffix="Jahre" />
      </Field>

      {/* Komponenten */}
      <SectionHeader>Kalkulation – Module & Wechselrichter</SectionHeader>
      {project.componentPricing.acquisition.mode === 'turnkey' && (
        <div className="mb-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs font-bold leading-5 text-blue-800">
          Interne Preisprüfung: Diese Komponentenwerte werden bei der schlüsselfertigen Anlage nicht
          zum Kaufpreis addiert.
        </div>
      )}
      <CapexComponentPricing project={project} calc={calc} onChange={onChange} />

      {/* Unterkonstruktion */}
      <SectionHeader>Kalkulation – Unterkonstruktion</SectionHeader>
      <CapexMountingPricing project={project} projectOption={projectOption} calc={calc} onChange={onChange} />

      {(project.componentPricing.acquisition.mode === 'epc'
        || project.componentPricing.acquisition.mode === 'project_rights_epc') && (
        <>
          {/* DC/AC */}
          <SectionHeader>Kalkulation – DC- und AC-Installation</SectionHeader>
          <Field label="Elektroinstallation (AC) – Preis pro kWp">
            <NumInput value={project.acPreisProKwp} onChange={(v) => set('acPreisProKwp', Number(v))} suffix="€/kWp" />
          </Field>
          <Field label="Montagearbeiten (DC) – Preis pro kWp">
            <NumInput value={project.dcPreisProKwp} onChange={(v) => set('dcPreisProKwp', Number(v))} suffix="€/kWp" />
          </Field>
          <InfoLine>
            AC: <strong>{eur(calc.acTotal)}</strong> · DC: <strong>{eur(calc.dcTotal)}</strong>
          </InfoLine>

          {/* Weitere CAPEX-Positionen */}
          <SectionHeader>Weitere CAPEX-Positionen</SectionHeader>
          <Field label="Planung, Genehmigung & Engineering (€)">
            <NumInput value={project.planungEngineering} onChange={(v) => set('planungEngineering', Number(v))} suffix="€" />
          </Field>
          <Field label="Bauliche Maßnahmen / Erdarbeiten (€)">
            <NumInput value={project.baulicheMassnahmen} onChange={(v) => set('baulicheMassnahmen', Number(v))} suffix="€" />
          </Field>
          <Field label="Logistik & Transport (€)">
            <NumInput value={project.logistikTransport} onChange={(v) => set('logistikTransport', Number(v))} suffix="€" />
          </Field>
          <Field label="Inbetriebnahme & Abnahme (€)">
            <NumInput value={project.inbetriebnahme} onChange={(v) => set('inbetriebnahme', Number(v))} suffix="€" />
          </Field>
          <Field label="Sonstige Kosten / Contingency (€)">
            <NumInput value={project.contingency} onChange={(v) => set('contingency', Number(v))} suffix="€" />
          </Field>
          <Field
            label="Einmalige Pachtzahlung (€/kWp)"
            hint={`Pachtdauer: ${project.pachtdauerJahre} Jahre`}
          >
            <NumInput value={project.pachtzahlungProKwp} onChange={(v) => set('pachtzahlungProKwp', Number(v))} suffix="€/kWp" />
          </Field>
          {project.componentPricing.acquisition.mode === 'project_rights_epc' && (
            <Field label="Einmalige Zahlung für Projektrechte (€/kWp)">
              <NumInput value={project.projektrechteProKwp} onChange={(v) => set('projektrechteProKwp', Number(v))} suffix="€/kWp" />
            </Field>
          )}
        </>
      )}

      {/* Cashflow-Annahmen */}
      <SectionHeader>Cashflow-Annahmen (20 Jahre)</SectionHeader>
      <Field
        label="Jährliche Erlössteigerung (%)"
        hint="EEG: 0 %. Bei PPA oder Direktvermarktung nur eine vertraglich bzw. konservativ begründete Annahme eintragen."
      >
        <NumInput value={project.strompreissteigerungPct} onChange={(v) => set('strompreissteigerungPct', Number(v))} step="0.1" min="-99.9" suffix="%" />
      </Field>
      <InfoLine>
        Laufende Betriebskosten steigen im Investor-Basisfall jährlich um{' '}
        <strong>{INVESTOR_OPEX_ESCALATION_PCT.toLocaleString('de-DE')} %</strong>.
      </InfoLine>
      <Field label="Diskontierungszinssatz / WACC (%)">
        <NumInput value={project.waccPct} onChange={(v) => set('waccPct', Number(v))} step="0.1" suffix="%" />
      </Field>

      {/* CAPEX breakdown table */}
      <SectionHeader>CAPEX-Aufstellung</SectionHeader>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        {calc.positions.map((pos, i) => (
          <div
            key={pos.name}
            className={`flex justify-between gap-2 border-b border-slate-100 px-2.5 py-2 text-xs ${
              i % 2 === 1 ? 'bg-slate-50' : 'bg-white'
            }`}
          >
            <span className="flex-1">{pos.name}</span>
            <span className="whitespace-nowrap font-bold">{eur(pos.cost)}</span>
            <span className="min-w-[42px] whitespace-nowrap text-right text-slate-400">
              {pct(pos.share)}
            </span>
          </div>
        ))}
        <div className="flex justify-between bg-[#EAF7E0] px-2.5 py-2.5 text-[13px] font-extrabold">
          <span>Gesamt-CAPEX</span>
          <span>{eur(calc.totalCapex)}</span>
          <span>100,0 %</span>
        </div>
      </div>

      {/* Save buttons */}
      <div className="mt-4 flex gap-2">
        <button
          onClick={onSave}
          disabled={saving}
          className="flex-1 rounded-lg bg-[#5CB800] py-3.5 text-sm font-extrabold text-white disabled:opacity-60"
        >
          {saving ? 'Speichert…' : 'Kalkulation speichern'}
        </button>
        <button
          onClick={onNew}
          className="rounded-lg border border-slate-300 bg-white px-4 py-3.5 text-sm font-bold text-slate-700"
        >
          Neu
        </button>
      </div>
    </>
  )
}
