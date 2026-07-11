'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  Calculator,
  CheckCircle2,
  FileText,
  FolderOpen,
  Loader2,
  MapPin,
  Save,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import ExposeButton from '@/components/projects/ExposeButton'

export type EmaAiProject = {
  id: string
  projectNumber: string | null
  projectName: string
  projectType: string | null
  status: string | null
  locationCity: string | null
  locationState: string | null
  pvKwp: number | null
  bessMw: number | null
  bessMwh: number | null
  purchasePrice: number | null
  feedInType: string | null
  tariff: number | string | null
  specificYield: number | string | null
  rawProject: Record<string, unknown>
}

function cleanNumberInput(value: unknown) {
  return String(value ?? '')
    .trim()
    .replace(/\s/g, '')
    .replace(/€/g, '')
    .replace(/ct\/?kwh/gi, '')
    .replace(/kwh\/?kwp/gi, '')
}

function decimalValue(value: unknown) {
  if (value === null || value === undefined || value === '') return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0

  const cleaned = cleanNumberInput(value)
  if (!cleaned) return 0

  let normalized = cleaned
  if (cleaned.includes(',') && cleaned.includes('.')) {
    normalized = cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned.replace(/,/g, '')
  } else if (cleaned.includes(',')) {
    normalized = cleaned.replace(',', '.')
  } else if ((cleaned.match(/\./g) ?? []).length > 1) {
    normalized = cleaned.replace(/\./g, '')
  }

  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function moneyValue(value: unknown) {
  if (value === null || value === undefined || value === '') return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0

  const cleaned = cleanNumberInput(value)
  if (!cleaned) return 0

  const normalized = cleaned.includes(',')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned.replace(/\./g, '')

  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatGermanIntegerInput(value: unknown) {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (!digits) return ''
  return Number(digits).toLocaleString('de-DE', { maximumFractionDigits: 0 })
}

function formatProject(project: EmaAiProject) {
  return project.projectNumber
    ? `${project.projectNumber} – ${project.projectName}`
    : project.projectName
}

export function EmaAiAssistantV2({ projects }: { projects: EmaAiProject[] }) {
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const selectedProject = projects.find((project) => project.id === selectedProjectId)
  const [purchasePrice, setPurchasePrice] = useState('')
  const [specificYield, setSpecificYield] = useState('')
  const [tariff, setTariff] = useState('')
  const [isEstimatingYield, setIsEstimatingYield] = useState(false)
  const [yieldMessage, setYieldMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')

  useEffect(() => {
    setPurchasePrice(selectedProject?.purchasePrice ? formatGermanIntegerInput(selectedProject.purchasePrice) : '')
    setSpecificYield(selectedProject?.specificYield ? String(selectedProject.specificYield) : '')
    setTariff(selectedProject?.tariff ? String(selectedProject.tariff).replace('.', ',') : '')
    setYieldMessage('')
    setSaveMessage('')
  }, [selectedProjectId, selectedProject])

  async function estimateSpecificYield() {
    if (!selectedProject?.locationCity && !selectedProject?.locationState) {
      setYieldMessage('Für die automatische Ermittlung fehlt der Projektstandort.')
      return
    }

    setIsEstimatingYield(true)
    setYieldMessage('Spezifischer Ertrag wird anhand des Standorts ermittelt ...')

    try {
      const params = new URLSearchParams()
      if (selectedProject.locationCity) params.set('city', selectedProject.locationCity)
      if (selectedProject.locationState) params.set('state', selectedProject.locationState)
      const response = await fetch(`/api/solar-yield?${params.toString()}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || 'Ermittlung fehlgeschlagen')
      setSpecificYield(String(data.specificYield))
      setYieldMessage(`${data.specificYield.toLocaleString('de-DE')} kWh/kWp automatisch ermittelt. ${data.assumptions}`)
    } catch (error) {
      setYieldMessage(error instanceof Error ? error.message : 'Der Wert konnte nicht automatisch ermittelt werden. Bitte manuell eintragen.')
    } finally {
      setIsEstimatingYield(false)
    }
  }

  async function saveValues() {
    if (!selectedProject) return
    setIsSaving(true)
    setSaveMessage('Werte werden gespeichert ...')

    try {
      const response = await fetch('/api/ema-ai/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProject.id,
          purchasePrice: moneyValue(purchasePrice),
          specificYield: decimalValue(specificYield),
          tariff: decimalValue(tariff),
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || 'Speichern fehlgeschlagen')
      setSaveMessage('Gespeichert. Beim nächsten Öffnen des Projekts sind die Werte wieder vorhanden.')
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : 'Die Werte konnten nicht gespeichert werden.')
    } finally {
      setIsSaving(false)
    }
  }

  const calculation = useMemo(() => {
    if (!selectedProject) return null
    const kwp = decimalValue(selectedProject.pvKwp)
    const price = moneyValue(purchasePrice)
    const yieldPerKwp = decimalValue(specificYield)
    let tariffValue = decimalValue(tariff)
    if (tariffValue > 1) tariffValue /= 100
    const annualProduction = kwp * yieldPerKwp
    const annualRevenue = annualProduction * tariffValue
    const amortizationYears = annualRevenue > 0 ? price / annualRevenue : 0
    const required = [
      { label: 'Kaufpreis', complete: price > 0 },
      { label: 'PV-Leistung', complete: kwp > 0 },
      { label: 'Spezifischer Ertrag', complete: yieldPerKwp > 0 },
      { label: 'Vergütung', complete: tariffValue > 0 },
    ]
    const missing = required.filter((item) => !item.complete).map((item) => item.label)
    const completenessScore = Math.round((required.filter((item) => item.complete).length / required.length) * 100)
    return { kwp, price, yieldPerKwp, tariffValue, annualProduction, annualRevenue, amortizationYears, required, missing, completenessScore, complete: missing.length === 0 }
  }, [selectedProject, purchasePrice, specificYield, tariff])

  const exposeProject = selectedProject
    ? {
        ...selectedProject.rawProject,
        purchase_price: moneyValue(purchasePrice) || null,
        deal_purchase_price: moneyValue(purchasePrice) || null,
        tariff: decimalValue(tariff) || null,
        feed_in_tariff: decimalValue(tariff) || null,
        specific_yield: decimalValue(specificYield) || null,
      }
    : null

  return (
    <div className="min-h-[calc(100vh-8rem)] bg-gradient-to-b from-[#f7f9fc] via-white to-[#f4f8f1] pb-10 pt-[max(5.5rem,calc(env(safe-area-inset-top)+3rem))] md:rounded-[2rem] md:px-8 md:pt-10">
      <div className="mx-auto w-full max-w-5xl px-4 md:px-0">
        <div className="mb-5 flex items-center justify-between">
          <Link href="/dashboard" className="inline-flex min-h-12 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-[#07142F] shadow-sm">
            <ArrowLeft className="h-5 w-5" /> Dashboard
          </Link>
        </div>

        <section className="overflow-hidden rounded-[1.9rem] bg-white shadow-[0_22px_70px_rgba(15,23,42,0.09)] md:rounded-[2.2rem]">
          <div className="relative overflow-hidden rounded-[1.9rem] bg-gradient-to-br from-[#07142F] via-[#091a3b] to-[#16472f] px-5 py-7 text-white md:rounded-[2.2rem] md:px-9 md:py-10">
            <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#5CB800]/20 blur-2xl" />
            <div className="relative flex items-start gap-4 md:gap-6">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.4rem] bg-[#5CB800] shadow-lg shadow-[#5CB800]/20 md:h-20 md:w-20"><Bot className="h-8 w-8 text-white md:h-10 md:w-10" /></div>
              <div className="min-w-0">
                <p className="text-xs font-extrabold uppercase tracking-[0.24em] text-[#87d33b] md:text-sm">EMA Intelligence</p>
                <h1 className="mt-1 text-4xl font-extrabold tracking-tight md:text-5xl">EMA-AI</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 md:text-lg md:leading-8">Prüft die Exposé-Daten, berechnet die Amortisation und erstellt anschließend das Investoren-PDF.</p>
              </div>
            </div>
            <div className="relative mt-7 flex flex-col gap-3">
              <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-4 py-3 text-sm font-extrabold text-white ring-1 ring-white/10"><Sparkles className="h-5 w-5 text-[#87d33b]" /> Exposé-Engine aktiv</span>
              <div className="relative w-full">
                <FolderOpen className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white" />
                <select value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)} className="w-full appearance-none rounded-full border border-white/15 bg-white/10 py-3 pl-12 pr-11 text-sm font-extrabold text-white outline-none" aria-label="Projekt auswählen">
                  <option value="" className="text-slate-900">Projekt auswählen</option>
                  {projects.map((project) => <option key={project.id} value={project.id} className="text-slate-900">{formatProject(project)}</option>)}
                </select>
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white">⌄</span>
              </div>
            </div>
          </div>

          {selectedProject ? (
            <div className="space-y-5 p-4 md:p-7">
              <div className="grid gap-5 md:grid-cols-[0.8fr_1.2fr]">
                <div className="rounded-[1.7rem] border border-slate-200 bg-slate-50/70 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#5CB800]">Exposé-Bereitschaft</p><p className="mt-2 text-4xl font-extrabold text-[#07142F]">{calculation?.completenessScore ?? 0}%</p></div>
                    <TrendingUp className="h-9 w-9 text-[#5CB800]" />
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-[#5CB800] transition-all" style={{ width: `${calculation?.completenessScore ?? 0}%` }} /></div>
                  <div className="mt-5 space-y-3">
                    {calculation?.required.map((item) => <div key={item.label} className="flex items-center justify-between rounded-xl bg-white px-3 py-3 shadow-sm"><span className="text-sm font-bold text-[#07142F]">{item.label}</span>{item.complete ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <AlertTriangle className="h-5 w-5 text-amber-500" />}</div>)}
                  </div>
                </div>

                <div className="rounded-[1.7rem] border border-slate-200 bg-slate-50/70 p-5">
                  <div className="flex items-start gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#5CB800]/10 text-[#378c00]"><Calculator className="h-6 w-6" /></span>
                    <div><h2 className="text-lg font-extrabold text-[#07142F]">Amortisation</h2><p className="mt-1 text-sm leading-6 text-slate-500">Fehlende Werte können manuell ergänzt und anschließend dauerhaft gespeichert werden.</p></div>
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <label className="block"><span className="text-xs font-bold text-slate-500">Kaufpreis in €</span><input value={purchasePrice} onChange={(event) => { setPurchasePrice(formatGermanIntegerInput(event.target.value)); setSaveMessage('') }} inputMode="numeric" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-[#07142F] outline-none focus:border-[#5CB800]" /></label>
                    <label className="block">
                      <span className="text-xs font-bold text-slate-500">Ertrag kWh/kWp</span>
                      <input value={specificYield} onChange={(event) => { setSpecificYield(event.target.value); setYieldMessage(''); setSaveMessage('') }} inputMode="decimal" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-[#07142F] outline-none focus:border-[#5CB800]" />
                      <button type="button" onClick={estimateSpecificYield} disabled={isEstimatingYield || (!selectedProject.locationCity && !selectedProject.locationState)} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#5CB800]/30 bg-[#5CB800]/10 px-3 py-2 text-xs font-extrabold text-[#2F8A00] disabled:cursor-not-allowed disabled:opacity-50">{isEstimatingYield ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}Aus Standort berechnen</button>
                    </label>
                    <label className="block"><span className="text-xs font-bold text-slate-500">Vergütung ct/kWh oder €/kWh</span><input value={tariff} onChange={(event) => { setTariff(event.target.value); setSaveMessage('') }} inputMode="decimal" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-[#07142F] outline-none focus:border-[#5CB800]" /></label>
                  </div>

                  <button type="button" onClick={saveValues} disabled={isSaving} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#5CB800] px-4 py-3 text-sm font-extrabold text-white shadow-sm transition active:scale-[0.99] disabled:opacity-60">
                    {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                    Werte speichern
                  </button>

                  {yieldMessage && <div className="mt-3 rounded-xl bg-white p-3 text-xs font-bold leading-5 text-slate-600 shadow-sm">{yieldMessage}</div>}
                  {saveMessage && <div className="mt-3 rounded-xl border border-[#5CB800]/20 bg-[#5CB800]/10 p-3 text-xs font-bold leading-5 text-[#2F7000]">{saveMessage}</div>}

                  {calculation?.complete ? (
                    <div className="mt-5 rounded-2xl bg-[#07142F] p-5 text-white">
                      <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#87d33b]">Berechnetes Ergebnis</p>
                      <p className="mt-2 text-4xl font-extrabold">{calculation.amortizationYears.toLocaleString('de-DE', { maximumFractionDigits: 1 })} Jahre</p>
                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><p className="text-slate-400">Jahresproduktion</p><p className="font-extrabold">{calculation.annualProduction.toLocaleString('de-DE', { maximumFractionDigits: 0 })} kWh</p></div><div><p className="text-slate-400">Jahreserlös</p><p className="font-extrabold">{calculation.annualRevenue.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}</p></div></div>
                    </div>
                  ) : <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><strong>Noch nicht bereit:</strong> Es fehlen {calculation?.missing.join(', ') || 'notwendige Werte'}.</div>}
                </div>
              </div>

              <div className="rounded-[1.7rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start gap-3"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#5CB800]/10 text-[#378c00]"><FileText className="h-6 w-6" /></span><div className="min-w-0 flex-1"><h2 className="text-lg font-extrabold text-[#07142F]">Investoren-Exposé erstellen</h2><p className="mt-1 text-sm leading-6 text-slate-500">Der PDF-Button wird erst freigegeben, wenn die vier notwendigen Werte vollständig sind.</p></div></div>
                <div className="mt-5">{calculation?.complete && exposeProject ? <ExposeButton project={exposeProject as any} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#07142F] px-5 py-4 text-sm font-extrabold text-white shadow-lg transition active:scale-[0.99]" /> : <button disabled className="w-full rounded-2xl bg-slate-200 px-5 py-4 text-sm font-extrabold text-slate-500">Exposé noch nicht freigegeben</button>}</div>
              </div>
            </div>
          ) : <div className="p-7"><div className="rounded-2xl bg-slate-100 p-5 text-sm font-bold text-slate-500">Wähle zuerst ein Projekt aus.</div></div>}
        </section>
      </div>
    </div>
  )
}
