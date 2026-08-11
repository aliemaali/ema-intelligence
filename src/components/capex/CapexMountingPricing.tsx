'use client'

import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, Loader2, MapPin, RefreshCw, ShieldCheck } from 'lucide-react'
import { eur } from '@/lib/capex/format'
import {
  getMountingRecommendations,
  GROUND_TERRAIN_TYPES,
  ROOF_SURFACE_TYPES,
} from '@/lib/capex/mountingCatalog'
import { MODULE_CATALOG } from '@/lib/capex/componentCatalog'
import type {
  CapexCalcResult,
  CapexProject,
  ComponentPriceSource,
  MountingConfiguration,
  ProjectOption,
} from '@/lib/types/capex.types'
import { Field, InfoLine, NumInput, SelectInput } from './FormControls'

interface Props {
  project: CapexProject
  projectOption: ProjectOption
  calc: CapexCalcResult
  onChange: <K extends keyof CapexProject>(key: K, value: CapexProject[K]) => void
}

function money(value: number) {
  return Number.isFinite(value) ? value.toFixed(2).replace('.', ',') : '0,00'
}

export function CapexMountingPricing({ project, projectOption, calc, onChange }: Props) {
  const config = project.componentPricing.mounting
  const [loadingLoads, setLoadingLoads] = useState(false)
  const [loadingPrice, setLoadingPrice] = useState(false)
  const [message, setMessage] = useState('')

  const recommendations = useMemo(() => getMountingRecommendations(
    config.application,
    config.surfaceType,
    config.terrainType,
  ), [config.application, config.surfaceType, config.terrainType])

  useEffect(() => {
    if (
      !project.componentPricing.module.manufacturer
      || (config.moduleLengthMm > 0 && config.moduleWidthMm > 0 && config.moduleHeightMm > 0)
    ) return

    const catalogModule = MODULE_CATALOG.find((item) => (
      item.manufacturer === project.componentPricing.module.manufacturer
    ))
    if (!catalogModule) return

    onChange('componentPricing', {
      ...project.componentPricing,
      mounting: {
        ...config,
        moduleLengthMm: catalogModule.lengthMm,
        moduleWidthMm: catalogModule.widthMm,
        moduleHeightMm: catalogModule.heightMm,
      },
    })
  }, [
    config,
    config.moduleHeightMm,
    config.moduleLengthMm,
    config.moduleWidthMm,
    onChange,
    project.componentPricing,
    project.componentPricing.module.manufacturer,
  ])

  function update(patch: Partial<MountingConfiguration>) {
    onChange('componentPricing', {
      ...project.componentPricing,
      mounting: { ...config, ...patch },
    })
  }

  function chooseApplication(application: 'roof' | 'ground') {
    update({
      application,
      surfaceType: '',
      terrainType: '',
      manufacturer: '',
      system: '',
      onlineAverageNetEurPerKwp: 0,
      priceDate: '',
      sources: [],
    })
    onChange('ukHersteller', '')
    onChange('ukPreisProKwp', 0)
  }

  function chooseSystem(manufacturer: string, system: string, referenceEurPerKwp: number) {
    update({
      manufacturer,
      system,
      onlineAverageNetEurPerKwp: referenceEurPerKwp,
      priceDate: '',
      sources: [],
    })
    onChange('ukHersteller', `${manufacturer} · ${system}`)
    onChange('ukPreisProKwp', Math.round(referenceEurPerKwp * 0.8 * 100) / 100)
    setMessage('EMA-Richtwert eingesetzt. Für aktuelle Marktpreise bitte Preisermittlung starten.')
  }

  async function lookupLoads() {
    setLoadingLoads(true)
    setMessage('')
    try {
      const response = await fetch('/api/capex/site-loads', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          address: projectOption.location_address,
          city: projectOption.location_city,
          state: projectOption.location_state,
          country: projectOption.location_country,
          lat: projectOption.location_lat,
          lng: projectOption.location_lng,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Lastzonen konnten nicht ermittelt werden.')
      update({
        snowZone: data.snowZone || '',
        windZone: data.windZone || '',
        loadSourceUrl: data.sourceUrl || '',
        loadCheckedAt: data.checkedAt || new Date().toISOString(),
        loadConfidence: data.official ? 'official' : 'unverified',
      })
      setMessage(data.note || 'Wind- und Schneelastzone wurden für die Vorplanung übernommen.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Lastzonen konnten nicht ermittelt werden.')
    } finally {
      setLoadingLoads(false)
    }
  }

  async function researchPrice() {
    if (!config.manufacturer || !config.system) return
    setLoadingPrice(true)
    setMessage('')
    try {
      const response = await fetch('/api/capex/mounting-prices', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          manufacturer: config.manufacturer,
          system: config.system,
          application: config.application,
          surfaceType: config.surfaceType,
          terrainType: config.terrainType,
          plantKwp: project.anlagenleistungKwp,
          moduleLengthMm: config.moduleLengthMm,
          moduleWidthMm: config.moduleWidthMm,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Preisermittlung fehlgeschlagen.')
      const average = Number(data.averageNetEurPerKwp) || 0
      const used = Math.round(average * (1 - config.discountPct / 100) * 100) / 100
      update({
        onlineAverageNetEurPerKwp: average,
        priceDate: data.priceDate || new Date().toISOString().slice(0, 10),
        sources: Array.isArray(data.offers) ? data.offers : [],
      })
      onChange('ukPreisProKwp', used)
      setMessage(data.warning || 'Bereinigter Marktwert wurde übernommen.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Preisermittlung fehlgeschlagen.')
    } finally {
      setLoadingPrice(false)
    }
  }

  const location = [projectOption.location_address, projectOption.location_city, projectOption.location_state]
    .filter(Boolean).join(', ')

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {([['roof', 'Dachanlage'], ['ground', 'Freifläche']] as const).map(([value, label]) => (
          <button key={value} type="button" onClick={() => chooseApplication(value)}
            className={`min-h-14 rounded-xl border px-3 text-sm font-extrabold ${config.application === value ? 'border-[#5CB800] bg-[#eef9e5] text-[#2f7d00]' : 'border-slate-200 bg-white text-[#1F2A44]'}`}>
            {label}
          </button>
        ))}
      </div>

      {config.application === 'roof' && (
        <Field label="Dachart / Dacheindeckung">
          <SelectInput value={config.surfaceType} onChange={(surfaceType) => update({ surfaceType, manufacturer: '', system: '' })} options={ROOF_SURFACE_TYPES} />
        </Field>
      )}
      {config.application === 'ground' && (
        <Field label="Geländeart">
          <SelectInput value={config.terrainType} onChange={(terrainType) => update({ terrainType, manufacturer: '', system: '' })} options={GROUND_TERRAIN_TYPES} />
        </Field>
      )}

      <Field label="Ausrichtung">
        <select value={config.orientation} onChange={(event) => update({ orientation: event.target.value as MountingConfiguration['orientation'] })}
          className="w-full rounded-lg border border-slate-300 bg-[#fffdf0] px-3 py-2.5 text-[15px]">
          <option value="">Bitte auswählen</option>
          <option value="south">Süd</option>
          <option value="east-west">Ost/West</option>
        </select>
      </Field>

      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <div className="mb-2 text-xs font-extrabold uppercase tracking-wider text-[#5CB800]">Modulabmessungen</div>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Länge (mm)"><NumInput value={config.moduleLengthMm} onChange={(value) => update({ moduleLengthMm: Number(value) })} suffix="mm" /></Field>
          <Field label="Breite (mm)"><NumInput value={config.moduleWidthMm} onChange={(value) => update({ moduleWidthMm: Number(value) })} suffix="mm" /></Field>
          <Field label="Rahmen (mm)"><NumInput value={config.moduleHeightMm} onChange={(value) => update({ moduleHeightMm: Number(value) })} suffix="mm" /></Field>
        </div>
        <p className="text-[11px] leading-4 text-slate-500">Exaktes Katalogmodell: automatisch. Freie Leistungsklasse: Maße bitte prüfen oder ergänzen.</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-[#5CB800]"><MapPin className="h-4 w-4" /> Standortlasten</div>
        <p className="mt-1 text-xs text-slate-500">{location || 'Im Projekt ist noch kein eindeutiger Standort hinterlegt.'}</p>
        <button type="button" onClick={lookupLoads} disabled={loadingLoads || !projectOption.location_city}
          className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1F2A44] px-3 text-sm font-extrabold text-white disabled:opacity-40">
          {loadingLoads ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Wind- & Schneelast ermitteln
        </button>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Field label="Windzone"><input value={config.windZone} onChange={(e) => update({ windZone: e.target.value, loadConfidence: 'manual' })} className="w-full rounded-lg border border-slate-300 bg-[#fffdf0] px-3 py-2.5" /></Field>
          <Field label="Schneelastzone"><input value={config.snowZone} onChange={(e) => update({ snowZone: e.target.value, loadConfidence: 'manual' })} className="w-full rounded-lg border border-slate-300 bg-[#fffdf0] px-3 py-2.5" /></Field>
        </div>
        {config.loadSourceUrl && <a href={config.loadSourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-[#2f7d00]"><ShieldCheck className="h-4 w-4" /> Offizielle Zuordnungsgrundlage <ExternalLink className="h-3 w-3" /></a>}
      </div>

      {!!recommendations.length && (
        <div>
          <div className="mb-2 text-xs font-extrabold uppercase tracking-wider text-slate-500">Passende Systeme</div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {recommendations.map((item) => (
              <button key={`${item.manufacturer}-${item.system}`} type="button" onClick={() => chooseSystem(item.manufacturer, item.system, item.referenceEurPerKwp)}
                className={`rounded-xl border p-3 text-left ${config.manufacturer === item.manufacturer && config.system === item.system ? 'border-[#5CB800] bg-[#eef9e5]' : 'border-slate-200 bg-white'}`}>
                <span className="block text-sm font-extrabold text-[#1F2A44]">{item.manufacturer}</span>
                <span className="block text-xs text-slate-500">{item.system} · Richtwert {money(item.referenceEurPerKwp)} €/kWp</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {config.manufacturer && (
        <div className="rounded-2xl border border-slate-200 bg-white p-3">
          <div className="text-xs font-bold text-[#5CB800]">EMPFOHLENES MONTAGESYSTEM</div>
          <div className="mt-1 text-lg font-extrabold text-[#1F2A44]">{config.manufacturer} · {config.system}</div>
          <button type="button" onClick={researchPrice} disabled={loadingPrice}
            className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1F2A44] px-3 text-sm font-extrabold text-white">
            {loadingPrice ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Marktpreise ermitteln
          </button>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl bg-slate-50 p-3"><span className="block text-slate-500">Online-Ø netto</span><strong>{money(config.onlineAverageNetEurPerKwp)} €/kWp</strong></div>
            <div className="rounded-xl bg-slate-50 p-3"><span className="block text-slate-500">Preisstand</span><strong>{config.priceDate || 'Richtwert'}</strong></div>
          </div>
          {!!config.sources.length && <details className="mt-3 rounded-xl border border-slate-200"><summary className="cursor-pointer px-3 py-2 text-xs font-extrabold">Interne Preisquellen ({config.sources.length}) · nicht im PDF</summary><div className="border-t border-slate-100 px-3">{config.sources.map((source: ComponentPriceSource) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="flex justify-between gap-2 border-b border-slate-100 py-2 text-xs last:border-0"><span>{source.retailer}</span><strong>{money(source.priceNetEur)} €/kWp</strong></a>)}</div></details>}
        </div>
      )}

      <Field label="Großhandels-/Projektabschlag (%)">
        <NumInput value={config.discountPct} onChange={(value) => {
          const discountPct = Math.max(0, Math.min(60, Number(value)))
          update({ discountPct })
          if (config.onlineAverageNetEurPerKwp > 0) onChange('ukPreisProKwp', Math.round(config.onlineAverageNetEurPerKwp * (1 - discountPct / 100) * 100) / 100)
        }} suffix="%" />
      </Field>
      <Field label="Verwendeter Preis Unterkonstruktion (netto)">
        <NumInput value={project.ukPreisProKwp} onChange={(value) => onChange('ukPreisProKwp', Math.round(Number(value) * 100) / 100)} step="0.01" suffix="€/kWp" />
      </Field>
      <InfoLine>Gesamtkosten Unterkonstruktion: <strong>{eur(calc.ukTotal)}</strong></InfoLine>
      {message && <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">{message}</div>}
      <div className="rounded-xl border border-[#b7dd94] bg-[#f4faef] px-3 py-2 text-[11px] leading-4 text-[#315b1d]">
        CAPEX-Vorplanung. Wind-/Schneezone und Hersteller-Richtwerte ersetzen keine prüffähige Statik, Ballastierung, Befestigungs- oder Gründungsplanung.
      </div>
    </div>
  )
}
