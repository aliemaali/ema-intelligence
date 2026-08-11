'use client'

import { useState } from 'react'
import { ExternalLink, Loader2, RefreshCw, ShieldCheck } from 'lucide-react'
import {
  getInverterRecommendation,
  getModuleRecommendation,
  INVERTER_MANUFACTURERS,
  MODULE_MANUFACTURERS,
} from '@/lib/capex/componentCatalog'
import type {
  CapexCalcResult,
  CapexProject,
  ComponentKind,
  ComponentPriceSource,
  ComponentPricingSelection,
} from '@/lib/types/capex.types'
import { eur, num } from '@/lib/capex/format'
import { Field, InfoLine, NumInput } from './FormControls'

interface Props {
  project: CapexProject
  calc: CapexCalcResult
  onChange: <K extends keyof CapexProject>(key: K, value: CapexProject[K]) => void
}

type ResearchResponse = {
  averageOnlineNetEur: number
  priceDate: string
  offers: ComponentPriceSource[]
  sourceCount: number
  averagedOfferCount: number
  error?: string
}

function formatDate(value: string) {
  if (!value) return '–'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('de-DE').format(date)
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function PriceSourceList({ sources }: { sources: ComponentPriceSource[] }) {
  if (!sources.length) return null

  return (
    <details className="mt-3 rounded-xl border border-slate-200 bg-white">
      <summary className="cursor-pointer px-3 py-2.5 text-xs font-extrabold text-[#1F2A44]">
        Interne Preisquellen ({sources.length}) · nicht im PDF
      </summary>
      <div className="border-t border-slate-100 px-3 py-2">
        {sources.map((source) => (
          <a
            key={source.url}
            href={source.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-start justify-between gap-3 border-b border-slate-100 py-2 text-xs last:border-b-0"
          >
            <span className="min-w-0">
              <span className="block truncate font-bold text-[#1F2A44]">{source.retailer}</span>
              <span className="block text-[11px] text-slate-500">
                {source.note || 'Verfügbares Netto-Angebot'}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1 font-extrabold text-[#2f7d00]">
              {eur(source.priceNetEur)}
              <ExternalLink className="h-3.5 w-3.5" />
            </span>
          </a>
        ))}
      </div>
    </details>
  )
}

export function CapexComponentPricing({ project, calc, onChange }: Props) {
  const [loading, setLoading] = useState<ComponentKind | null>(null)
  const [errors, setErrors] = useState<Partial<Record<ComponentKind, string>>>({})

  function selection(kind: ComponentKind) {
    return project.componentPricing[kind]
  }

  function updateSelection(kind: ComponentKind, patch: Partial<ComponentPricingSelection>) {
    onChange('componentPricing', {
      ...project.componentPricing,
      [kind]: {
        ...project.componentPricing[kind],
        ...patch,
      },
    })
  }

  function chooseModule(manufacturer: string) {
    const recommendation = getModuleRecommendation(manufacturer)
    if (!recommendation) return

    updateSelection('module', {
      manufacturer: recommendation.manufacturer,
      model: recommendation.model,
      ratedPower: recommendation.powerWp,
      onlineAverageNetEur: 0,
      priceDate: '',
      sources: [],
    })
    onChange('modulleistungWp', recommendation.powerWp)
    onChange('preisProModul', 0)
    setErrors((current) => ({ ...current, module: '' }))
  }

  function chooseInverter(manufacturer: string) {
    const recommendation = getInverterRecommendation(manufacturer, project.anlagenleistungKwp)
    if (!recommendation) return

    updateSelection('inverter', {
      manufacturer: recommendation.manufacturer,
      model: recommendation.model,
      ratedPower: recommendation.acPowerKw,
      onlineAverageNetEur: 0,
      priceDate: '',
      sources: [],
    })
    onChange('wrHersteller', recommendation.manufacturer)
    onChange('wrAnzahl', recommendation.quantity)
    onChange('wrEinzelpreis', 0)
    setErrors((current) => ({ ...current, inverter: '' }))
  }

  function updateDiscount(kind: ComponentKind, value: number) {
    const discountPct = Math.max(0, Math.min(60, value || 0))
    const current = selection(kind)
    updateSelection(kind, { discountPct })

    if (current.onlineAverageNetEur > 0) {
      const calculatedPrice = roundMoney(current.onlineAverageNetEur * (1 - discountPct / 100))
      onChange(kind === 'module' ? 'preisProModul' : 'wrEinzelpreis', calculatedPrice)
    }
  }

  async function researchPrice(kind: ComponentKind) {
    const current = selection(kind)
    if (!current.manufacturer || !current.model) {
      setErrors((state) => ({ ...state, [kind]: 'Bitte zuerst einen Hersteller auswählen.' }))
      return
    }

    setLoading(kind)
    setErrors((state) => ({ ...state, [kind]: '' }))
    try {
      const response = await fetch('/api/capex/component-prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          manufacturer: current.manufacturer,
          model: current.model,
        }),
      })
      const result = await response.json() as ResearchResponse
      if (!response.ok) throw new Error(result.error || 'Preisermittlung fehlgeschlagen.')

      const onlineAverageNetEur = roundMoney(result.averageOnlineNetEur)
      const finalPrice = roundMoney(onlineAverageNetEur * (1 - current.discountPct / 100))
      updateSelection(kind, {
        onlineAverageNetEur,
        priceDate: result.priceDate,
        sources: result.offers,
      })
      onChange(kind === 'module' ? 'preisProModul' : 'wrEinzelpreis', finalPrice)
    } catch (error) {
      setErrors((state) => ({
        ...state,
        [kind]: error instanceof Error ? error.message : 'Preisermittlung fehlgeschlagen.',
      }))
    } finally {
      setLoading(null)
    }
  }

  const moduleSelection = selection('module')
  const inverter = selection('inverter')
  const inverterRecommendation = inverter.manufacturer
    ? getInverterRecommendation(inverter.manufacturer, project.anlagenleistungKwp)
    : null

  return (
    <>
      <div className="mb-3 rounded-2xl border border-[#cfe8b9] bg-gradient-to-br from-[#f7fff1] to-white p-3.5">
        <div className="mb-1 flex items-center gap-2 text-sm font-extrabold text-[#1F2A44]">
          <ShieldCheck className="h-4.5 w-4.5 text-[#5CB800]" />
          EMA Komponenten-Assistent
        </div>
        <p className="text-xs leading-5 text-slate-600">
          Vorplanung auf Hersteller- und Modellbasis. Die elektrische Auslegung muss durch den
          Fachplaner geprüft werden. Preise sind unverbindliche Netto-Marktwerte.
        </p>
      </div>

      <div className="mb-3 text-xs font-extrabold uppercase tracking-[0.16em] text-slate-500">
        1 · Modulhersteller wählen
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-5">
        {MODULE_MANUFACTURERS.map((manufacturer) => (
          <button
            key={manufacturer}
            type="button"
            onClick={() => chooseModule(manufacturer)}
            className={`min-h-12 rounded-xl border px-2 py-2 text-xs font-extrabold transition-colors ${
              moduleSelection.manufacturer === manufacturer
                ? 'border-[#5CB800] bg-[#EAF7E0] text-[#2f7d00]'
                : 'border-slate-200 bg-white text-[#1F2A44]'
            }`}
          >
            {manufacturer}
          </button>
        ))}
      </div>

      {moduleSelection.manufacturer && (
        <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#5CB800]">
            Empfohlenes Modul
          </div>
          <div className="mt-1 font-extrabold text-[#1F2A44]">{moduleSelection.model}</div>
          <div className="mt-1 text-xs text-slate-600">
            {num(moduleSelection.ratedPower)} Wp · {num(calc.moduleCount)} Module · {num(calc.actualKwp, 2)} kWp
          </div>
          <button
            type="button"
            onClick={() => researchPrice('module')}
            disabled={loading !== null}
            className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1F2A44] px-3 text-xs font-extrabold text-white disabled:opacity-60"
          >
            {loading === 'module'
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <RefreshCw className="h-4 w-4" />}
            {loading === 'module' ? 'EMA sucht aktuelle Preise…' : 'Onlinepreise ermitteln'}
          </button>
          {errors.module && <p className="mt-2 text-xs font-semibold text-red-600">{errors.module}</p>}
          {moduleSelection.onlineAverageNetEur > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl bg-white p-2.5">
                <div className="text-slate-500">Bereinigter Online-Ø</div>
                <div className="mt-1 font-extrabold text-[#1F2A44]">{eur(moduleSelection.onlineAverageNetEur)}</div>
              </div>
              <div className="rounded-xl bg-white p-2.5">
                <div className="text-slate-500">Preisstand</div>
                <div className="mt-1 font-extrabold text-[#1F2A44]">{formatDate(moduleSelection.priceDate)}</div>
              </div>
            </div>
          )}
          <PriceSourceList sources={moduleSelection.sources} />
        </div>
      )}

      <Field label="Großhandelsabschlag Module (%)" hint="Standard 20 %. Kann kundenspezifisch angepasst werden.">
        <NumInput
          value={moduleSelection.discountPct}
          onChange={(value) => updateDiscount('module', Number(value))}
          max="60"
          step="1"
          suffix="%"
        />
      </Field>
      <Field label="Verwendeter Preis pro Modul (netto)">
        <NumInput
          value={roundMoney(project.preisProModul)}
          onChange={(value) => onChange('preisProModul', roundMoney(Number(value)))}
          step="0.01"
          suffix="€"
        />
      </Field>
      <InfoLine>
        Benötigte Module: <strong>{num(calc.moduleCount)} Stk.</strong> · Tatsächliche Leistung:{' '}
        <strong>{num(calc.actualKwp, 2)} kWp</strong> · Gesamtkosten:{' '}
        <strong>{eur(calc.moduleCost)}</strong>
      </InfoLine>

      <div className="mb-3 mt-6 text-xs font-extrabold uppercase tracking-[0.16em] text-slate-500">
        2 · Wechselrichterhersteller wählen
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-5">
        {INVERTER_MANUFACTURERS.map((manufacturer) => (
          <button
            key={manufacturer}
            type="button"
            onClick={() => chooseInverter(manufacturer)}
            className={`min-h-12 rounded-xl border px-2 py-2 text-xs font-extrabold transition-colors ${
              inverter.manufacturer === manufacturer
                ? 'border-[#5CB800] bg-[#EAF7E0] text-[#2f7d00]'
                : 'border-slate-200 bg-white text-[#1F2A44]'
            }`}
          >
            {manufacturer}
          </button>
        ))}
      </div>

      {inverter.manufacturer && inverterRecommendation && (
        <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#5CB800]">
            Vorläufige Wechselrichter-Empfehlung
          </div>
          <div className="mt-1 font-extrabold text-[#1F2A44]">{inverter.model}</div>
          <div className="mt-1 text-xs leading-5 text-slate-600">
            {num(inverter.ratedPower)} kW je Gerät · {num(project.wrAnzahl)} Stück ·{' '}
            {num(project.wrAnzahl * inverter.ratedPower)} kW AC · DC/AC ca.{' '}
            {num(inverterRecommendation.dcAcRatio, 2)}
          </div>
          <button
            type="button"
            onClick={() => researchPrice('inverter')}
            disabled={loading !== null}
            className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1F2A44] px-3 text-xs font-extrabold text-white disabled:opacity-60"
          >
            {loading === 'inverter'
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <RefreshCw className="h-4 w-4" />}
            {loading === 'inverter' ? 'EMA sucht aktuelle Preise…' : 'Onlinepreise ermitteln'}
          </button>
          {errors.inverter && <p className="mt-2 text-xs font-semibold text-red-600">{errors.inverter}</p>}
          {inverter.onlineAverageNetEur > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl bg-white p-2.5">
                <div className="text-slate-500">Bereinigter Online-Ø</div>
                <div className="mt-1 font-extrabold text-[#1F2A44]">{eur(inverter.onlineAverageNetEur)}</div>
              </div>
              <div className="rounded-xl bg-white p-2.5">
                <div className="text-slate-500">Preisstand</div>
                <div className="mt-1 font-extrabold text-[#1F2A44]">{formatDate(inverter.priceDate)}</div>
              </div>
            </div>
          )}
          <PriceSourceList sources={inverter.sources} />
        </div>
      )}

      <Field label="Großhandelsabschlag Wechselrichter (%)" hint="Standard 20 %. Kann kundenspezifisch angepasst werden.">
        <NumInput
          value={inverter.discountPct}
          onChange={(value) => updateDiscount('inverter', Number(value))}
          max="60"
          step="1"
          suffix="%"
        />
      </Field>
      <Field label="Verwendeter Einzelpreis pro Wechselrichter (netto)">
        <NumInput
          value={roundMoney(project.wrEinzelpreis)}
          onChange={(value) => onChange('wrEinzelpreis', roundMoney(Number(value)))}
          step="0.01"
          suffix="€"
        />
      </Field>
      <Field label="Anzahl Wechselrichter">
        <NumInput
          value={project.wrAnzahl}
          onChange={(value) => onChange('wrAnzahl', Number(value))}
          suffix="Stk."
        />
      </Field>
      <InfoLine>
        Gesamtpreis Wechselrichter: <strong>{eur(calc.wrTotal)}</strong>
      </InfoLine>
    </>
  )
}
