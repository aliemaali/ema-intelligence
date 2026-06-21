// src/components/capex/CapexForm.tsx
'use client'

import type { CapexCalcResult, CapexProject } from '@/lib/types/capex.types'
import { WECHSELRICHTER_HERSTELLER, UNTERKONSTRUKTION_HERSTELLER } from '@/lib/types/capex.types'
import { eur, eurKwp, pct, num } from '@/lib/capex/format'
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
}

export function CapexForm({ project, calc, onChange, onSave, onNew, saving }: CapexFormProps) {
  const set = onChange

  return (
    <>
      {/* KPI cards */}
      <div className="mt-3.5 flex flex-wrap gap-2">
        <KpiCard label="Gesamt-CAPEX" value={eur(calc.totalCapex)} />
        <KpiCard label="Spez. Kosten" value={eurKwp(calc.specificCapex)} />
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <KpiCard label="IRR (20J)" value={pct(calc.irr)} accent="#5CB800" />
        <KpiCard
          label="Payback (statisch)"
          value={calc.staticPayback ? num(calc.staticPayback, 1) + ' J.' : '–'}
        />
        <KpiCard label="NPV @ WACC" value={eur(calc.npv)} />
      </div>

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
        <NumInput value={project.degradationPct} onChange={(v) => set('degradationPct', Number(v))} step="0.1" suffix="%" />
      </Field>
      <Field label="Betriebskosten p.a. (% von CAPEX)">
        <NumInput value={project.betriebskostenPct} onChange={(v) => set('betriebskostenPct', Number(v))} step="0.1" suffix="%" />
      </Field>
      <Field label="Pachtdauer (Jahre)">
        <NumInput value={project.pachtdauerJahre} onChange={(v) => set('pachtdauerJahre', Number(v))} suffix="Jahre" />
      </Field>

      {/* Module */}
      <SectionHeader>Kalkulation – Module</SectionHeader>
      <Field label="Modulleistung (Wp pro Modul)">
        <NumInput value={project.modulleistungWp} onChange={(v) => set('modulleistungWp', Number(v))} suffix="Wp" />
      </Field>
      <Field label="Preis pro Modul (€)">
        <NumInput value={project.preisProModul} onChange={(v) => set('preisProModul', Number(v))} suffix="€" />
      </Field>
      <InfoLine>
        Benötigte Module: <strong>{num(calc.moduleCount)} Stk.</strong> · Tatsächliche
        Leistung: <strong>{num(calc.actualKwp, 2)} kWp</strong> · Gesamtkosten:{' '}
        <strong>{eur(calc.moduleCost)}</strong>
      </InfoLine>

      {/* Wechselrichter */}
      <SectionHeader>Kalkulation – Wechselrichter</SectionHeader>
      <Field label="Hersteller">
        <SelectInput
          value={project.wrHersteller}
          onChange={(v) => set('wrHersteller', v)}
          options={WECHSELRICHTER_HERSTELLER}
        />
      </Field>
      <Field label="Einzelpreis pro Wechselrichter (€)">
        <NumInput value={project.wrEinzelpreis} onChange={(v) => set('wrEinzelpreis', Number(v))} suffix="€" />
      </Field>
      <Field label="Anzahl Wechselrichter">
        <NumInput value={project.wrAnzahl} onChange={(v) => set('wrAnzahl', Number(v))} suffix="Stk." />
      </Field>
      <InfoLine>
        Gesamtpreis Wechselrichter: <strong>{eur(calc.wrTotal)}</strong> ({eurKwp(calc.wrEurPerKwp)})
      </InfoLine>

      {/* Unterkonstruktion */}
      <SectionHeader>Kalkulation – Unterkonstruktion</SectionHeader>
      <Field label="Hersteller">
        <SelectInput
          value={project.ukHersteller}
          onChange={(v) => set('ukHersteller', v)}
          options={UNTERKONSTRUKTION_HERSTELLER}
        />
      </Field>
      <Field label="Preis pro kWp (€/kWp)">
        <NumInput value={project.ukPreisProKwp} onChange={(v) => set('ukPreisProKwp', Number(v))} suffix="€/kWp" />
      </Field>
      <InfoLine>
        Gesamtkosten Unterkonstruktion: <strong>{eur(calc.ukTotal)}</strong>
      </InfoLine>

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
      <Field label="Einmalige Zahlung für Projektrechte (€/kWp)">
        <NumInput value={project.projektrechteProKwp} onChange={(v) => set('projektrechteProKwp', Number(v))} suffix="€/kWp" />
      </Field>

      {/* Cashflow-Annahmen */}
      <SectionHeader>Cashflow-Annahmen (20 Jahre)</SectionHeader>
      <Field label="Jährliche Strompreissteigerung (%)">
        <NumInput value={project.strompreissteigerungPct} onChange={(v) => set('strompreissteigerungPct', Number(v))} step="0.1" suffix="%" />
      </Field>
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
