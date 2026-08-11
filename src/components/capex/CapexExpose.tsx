// src/components/capex/CapexExpose.tsx
'use client'

import { useRef, type CSSProperties } from 'react'
import {
  capexCalculationModeLabel,
  type CapexCalcResult,
  type CapexProject,
} from '@/lib/types/capex.types'
import { eur, eurKwp, pct1, num } from '@/lib/capex/format'
import { INVESTOR_OPEX_ESCALATION_PCT } from '@/lib/capex/calculations'

const E_NAVY = '#0B2545'
const E_GREEN = '#5CB800'
const E_LIGHT = '#F4F6F8'
const E_GREY = '#8A95A5'
const E_BORDER = '#D8DEE6'

interface CapexExposeProps {
  project: CapexProject
  calc: CapexCalcResult
  onBack: () => void
}

function EKpi({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex-1 px-1 py-2.5 text-center">
      <div className="text-[15px] font-extrabold leading-tight" style={{ color: E_NAVY }}>
        {value}
      </div>
      <div className="mt-0.5 text-[8px]" style={{ color: E_GREY }}>
        {label}
      </div>
    </div>
  )
}

function ETable({
  head,
  rows,
  totalRow,
}: {
  head: string[]
  rows: string[][]
  totalRow?: string[]
}) {
  return (
    <table className="mt-1.5 w-full border-collapse text-[9px]">
      <thead>
        <tr>
          {head.map((h, i) => (
            <th
              key={i}
              className="px-2 py-1.5 text-[9px] font-bold text-white"
              style={{ background: E_NAVY, textAlign: i === head.length - 1 ? 'right' : 'left' }}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} style={{ background: i % 2 === 1 ? E_LIGHT : 'white' }}>
            {r.map((c, j) => (
              <td
                key={j}
                className="px-2 py-1.5"
                style={{
                  borderBottom: `1px solid ${E_BORDER}`,
                  textAlign: j === r.length - 1 ? 'right' : 'left',
                  color: '#1A2230',
                }}
              >
                {c}
              </td>
            ))}
          </tr>
        ))}
        {totalRow && (
          <tr>
            {totalRow.map((c, j) => (
              <td
                key={j}
                className="px-2 py-1.5 font-extrabold"
                style={{
                  borderTop: `1.5px solid ${E_NAVY}`,
                  textAlign: j === totalRow.length - 1 ? 'right' : 'left',
                  color: E_NAVY,
                }}
              >
                {c}
              </td>
            ))}
          </tr>
        )}
      </tbody>
    </table>
  )
}

function MiniBarChart({ values, height = 90 }: { values: number[]; height?: number }) {
  const max = Math.max(...values, 1)
  return (
    <div
      className="flex items-end gap-0.5 rounded px-1.5 pb-1 pt-2"
      style={{ height, border: `1px solid ${E_BORDER}`, background: 'white' }}
    >
      {values.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-sm"
          style={{ background: E_GREEN, height: `${Math.max(2, (v / max) * 100)}%` }}
        />
      ))}
    </div>
  )
}

function CumulativeChart({
  values,
  width = 680,
  height = 120,
}: {
  values: number[]
  width?: number
  height?: number
}) {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const n = values.length
  const pL = 44
  const pR = 10
  const pT = 10
  const pB = 16
  const iW = width - pL - pR
  const iH = height - pT - pB
  const pts = values.map((v, i) => [pL + (i / (n - 1)) * iW, pT + iH - ((v - min) / range) * iH])
  const zY = pT + iH - ((0 - min) / range) * iH
  const d = pts.map((p, i) => (i === 0 ? `M ${p[0]} ${p[1]}` : `L ${p[0]} ${p[1]}`)).join(' ')

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ border: `1px solid ${E_BORDER}`, borderRadius: 4, background: 'white' }}
    >
      <line x1={pL} y1={zY} x2={width - pR} y2={zY} stroke={E_GREY} strokeDasharray="3,3" strokeWidth={1} />
      <text x={4} y={zY + 3} fontSize="8" fill={E_GREY}>0</text>
      <text x={4} y={pT + 8} fontSize="8" fill={E_GREY}>{(max / 1000).toFixed(0)}k</text>
      <text x={4} y={height - 4} fontSize="8" fill={E_GREY}>{(min / 1000).toFixed(0)}k</text>
      <path d={d} fill="none" stroke={E_NAVY} strokeWidth={2} />
    </svg>
  )
}

function PageHeader({ projektname }: { projektname: string }) {
  return (
    <div
      className="absolute left-0 right-0 top-0 flex items-center justify-between px-[20mm]"
      style={{ height: '14mm', background: E_NAVY }}
    >
      <div className="absolute left-0 top-0" style={{ width: '4mm', height: '14mm', background: E_GREEN }} />
      <div className="text-[11px] font-extrabold text-white">EMA ENTERPRISE</div>
      <div className="text-[9.5px] text-white">{projektname} – Investoren-Exposé</div>
    </div>
  )
}

function PageFooter({ page }: { page: number }) {
  return (
    <div
      className="absolute flex justify-between pt-1 text-[7.5px]"
      style={{ bottom: '12mm', left: '20mm', right: '20mm', borderTop: `0.5px solid ${E_BORDER}`, color: E_GREY }}
    >
      <span>EMA Enterprise GmbH · Worms, Deutschland · www.ema-enterprise.de</span>
      <span>Seite {page}</span>
    </div>
  )
}

const pageStyle: CSSProperties = {
  width: '210mm',
  height: '297mm',
  margin: '12px auto',
  background: 'white',
  fontFamily: 'Arial, Helvetica, sans-serif',
  boxShadow: '0 2px 12px rgba(0,0,0,.15)',
  position: 'relative',
  boxSizing: 'border-box',
  padding: '20mm',
  display: 'flex',
  flexDirection: 'column',
  color: '#1A2230',
}

export function CapexExpose({ project, calc, onBack }: CapexExposeProps) {
  const calculationMode = project.componentPricing.acquisition.mode
  const calculationModeName = capexCalculationModeLabel(calculationMode)
  const isTurnkey = calculationMode === 'turnkey'
  const other = isTurnkey ? calc.positions : calc.positions.slice(5)
  const cfs = calc.years.slice(1).map((y) => y.ncf)
  const cum = calc.years.map((y) => y.cum)
  const pagesRef = useRef<HTMLDivElement>(null)

  function openPrint() {
    const el = pagesRef.current
    if (!el) return
    const win = window.open('', '_blank')
    if (!win) {
      alert('Pop-ups blockiert – bitte für diese Seite erlauben und erneut versuchen.')
      return
    }
    const html = `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"/>
<title>${project.projektname} – Exposé</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:Arial,Helvetica,sans-serif;background:#e9ecef;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
@media print{
  body{background:white;}
  .expose-page{page-break-after:always;box-shadow:none!important;margin:0!important;}
  .expose-page:last-child{page-break-after:auto;}
}
@page{size:A4;margin:0;}
</style></head><body>${el.innerHTML}</body></html>`
    win.document.open()
    win.document.write(html)
    win.document.close()
    setTimeout(() => {
      try {
        win.focus()
        win.print()
      } catch {
        /* noop */
      }
    }, 500)
  }

  return (
    <div className="min-h-screen" style={{ background: '#e9ecef' }}>
      {/* Toolbar */}
      <div
        className="sticky top-0 z-10 flex items-center justify-between gap-2 px-3.5 py-2.5"
        style={{ background: E_NAVY, color: 'white' }}
      >
        <button
          onClick={onBack}
          className="rounded-md border px-3.5 py-2 text-xs font-bold"
          style={{ borderColor: 'rgba(255,255,255,.3)', background: 'transparent', color: 'white' }}
        >
          ← Zurück
        </button>
        <div className="flex-1 text-center text-xs opacity-[0.85]">
          Exposé-Vorschau – Als PDF speichern öffnet Druckdialog
        </div>
        <button
          onClick={openPrint}
          className="rounded-md px-4 py-2 text-xs font-extrabold text-white"
          style={{ background: E_GREEN }}
        >
          Als PDF speichern
        </button>
      </div>
      <div className="px-3.5 py-1.5 text-center text-[11px]" style={{ background: '#FFF8E1', color: '#7A5A00' }}>
        Öffnet Druckansicht in neuem Tab → im Druckdialog „Als PDF speichern“ wählen. (Bei
        Pop-up-Blockierung: Browser-Einstellung für diese Seite anpassen)
      </div>

      <div ref={pagesRef}>
        {/* ===== COVER ===== */}
        <div className="expose-page" style={{ ...pageStyle, background: E_NAVY, color: 'white' }}>
          <div className="absolute left-0 right-0 top-0" style={{ height: '8mm', background: E_GREEN }} />
          <div style={{ marginTop: '14mm' }}>
            <span className="text-[22px] font-extrabold">EMA</span>
            <span className="ml-2.5 text-[22px] font-extrabold" style={{ color: E_GREEN }}>
              ENTERPRISE
            </span>
            <div className="mt-1.5 text-[9px]" style={{ color: '#C7D2E0' }}>
              Photovoltaik | Speicher | Netzanschluss | Worms, Deutschland
            </div>
          </div>
          <div style={{ marginTop: '55mm' }}>
            <div className="text-[28px] font-extrabold">Investoren-Exposé</div>
            <div className="mt-1.5 text-[20px] font-extrabold" style={{ color: E_GREEN }}>
              {project.projektname}
            </div>
            <div className="mt-2 text-[11px]" style={{ color: '#C7D2E0' }}>
              Photovoltaik-Großanlage · {num(project.anlagenleistungKwp)} kWp installierte Leistung
            </div>
          </div>
          <div className="flex-1" />
          <div>
            <div className="pt-6" style={{ borderTop: '0.7px solid #21426E' }}>
              <div className="flex">
                {[
                  [num(project.anlagenleistungKwp) + ' kWp', 'Anlagenleistung'],
                  [eur(calc.totalCapex), 'Investitionsvolumen'],
                  [pct1(calc.irr), 'Projekt-IRR vor Steuern'],
                  [calc.dynPayback !== null ? num(calc.dynPayback, 1) + ' J.' : '–', 'Payback diskontiert'],
                ].map(([v, l], i) => (
                  <div key={i} className="flex-1">
                    <div className="text-[16px] font-extrabold">{v}</div>
                    <div className="mt-0.5 text-[8px]" style={{ color: '#9FB3CC' }}>
                      {l}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-8 text-[8px]" style={{ color: '#7E92AD' }}>
              Vertraulich – ausschließlich zur Information potenzieller Investoren. Stand:{' '}
              {new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}.
            </div>
          </div>
        </div>

        {/* ===== PAGE 2 ===== */}
        <div className="expose-page" style={pageStyle}>
          <PageHeader projektname={project.projektname} />
          <div style={{ marginTop: '12mm' }}>
            <h1 className="mb-2 text-base font-extrabold" style={{ color: E_NAVY }}>
              1. Projektübersicht
            </h1>
            <p className="mb-2 text-[9.5px] leading-relaxed">
              Das Projekt „{project.projektname}“ umfasst die Errichtung einer
              Photovoltaik-Großanlage mit einer installierten Leistung von{' '}
              {num(project.anlagenleistungKwp)} kWp. Bei einem spezifischen Jahresertrag von{' '}
              {num(project.spezErtragKwhKwp)} kWh/kWp und einer angenommenen jährlichen
              Modul-Degradation von {num(project.degradationPct, 1)} % erzielt die Anlage über die
              betrachtete Laufzeit von 20 Jahren Erträge. Der Strompreis beträgt{' '}
              {Number(project.strompreisEurKwh).toLocaleString('de-DE', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 4,
              })}{' '}
              EUR/kWh mit einer jährlichen Steigerung von {num(project.strompreissteigerungPct, 1)}{' '}
              %. Betriebskosten im Jahr 1: {num(project.betriebskostenPct, 1)} % des CAPEX,
              anschließend +{num(INVESTOR_OPEX_ESCALATION_PCT, 1)} % p.a. · WACC:{' '}
              {num(project.waccPct, 1)} %
              {project.pachtdauerJahre > 0 ? ` · Pachtdauer: ${num(project.pachtdauerJahre)} Jahre.` : '.'}
            </p>
            <div className="mb-2 rounded px-2 py-1.5 text-[9px] font-extrabold" style={{ background: E_LIGHT, color: E_NAVY }}>
              Kalkulationsart: {calculationModeName}
              {isTurnkey ? ' · Komponentenpreise dienen nur der internen Plausibilitätsprüfung.' : ''}
            </div>

            <h2 className="mb-1 mt-2.5 text-[11.5px] font-extrabold" style={{ color: E_NAVY }}>
              Wirtschaftliche Eckdaten auf einen Blick
            </h2>
            <div
              className="mt-1.5 flex rounded"
              style={{ background: E_LIGHT, border: `0.5px solid ${E_BORDER}` }}
            >
              <EKpi value={eur(calc.totalCapex)} label="Gesamt-CAPEX" />
              <EKpi value={eurKwp(calc.specificCapex)} label="Spez. Investkosten" />
              <EKpi value={pct1(calc.irr)} label="Projekt-IRR vor Steuern" />
              <EKpi value={eur(calc.npv)} label={`NPV @ ${num(project.waccPct, 1)}% WACC`} />
              <EKpi
                value={calc.dynPayback !== null ? num(calc.dynPayback, 1) + ' Jahre' : '–'}
                label="Payback diskontiert"
              />
            </div>

            <h1 className="mb-2 mt-3.5 text-base font-extrabold" style={{ color: E_NAVY }}>
              2. Technische Anlagenkonfiguration
            </h1>
            <ETable
              head={['Komponente', 'Spezifikation', 'Menge / Kennwert', 'Kosten (EUR)']}
              rows={[
                [
                  'PV-Module',
                  `${num(project.modulleistungWp)} Wp je Modul`,
                  `${num(calc.moduleCount)} Stück`,
                  isTurnkey ? 'intern, nicht addiert' : eur(calc.moduleCost),
                ],
                [
                  project.componentPricing.inverterMode === 'hybrid'
                    ? 'Hybrid-Wechselrichter'
                    : 'Standard-Wechselrichter',
                  [project.wrHersteller, project.componentPricing.inverter.model]
                    .filter(Boolean)
                    .join(' · '),
                  `${num(project.wrAnzahl)} × ${eur(project.wrEinzelpreis)}`,
                  isTurnkey ? 'intern, nicht addiert' : eur(calc.wrTotal),
                ],
                [
                  'Unterkonstruktion',
                  [
                    project.ukHersteller,
                    project.componentPricing.mounting.application === 'roof' ? 'Dachanlage' : project.componentPricing.mounting.application === 'ground' ? 'Freifläche' : '',
                    project.componentPricing.mounting.windZone ? `Windzone ${project.componentPricing.mounting.windZone}` : '',
                    project.componentPricing.mounting.snowZone ? `Schneelastzone ${project.componentPricing.mounting.snowZone}` : '',
                  ].filter(Boolean).join(' · '),
                  `${num(project.ukPreisProKwp)} EUR/kWp`,
                  isTurnkey ? 'intern, nicht addiert' : eur(calc.ukTotal),
                ],
                [
                  'DC-Installation',
                  `${num(project.dcPreisProKwp)} EUR/kWp`,
                  `${num(project.anlagenleistungKwp)} kWp`,
                  isTurnkey ? 'im Kaufpreis enthalten' : eur(calc.dcTotal),
                ],
                [
                  'AC-Installation',
                  `${num(project.acPreisProKwp)} EUR/kWp`,
                  `${num(project.anlagenleistungKwp)} kWp`,
                  isTurnkey ? 'im Kaufpreis enthalten' : eur(calc.acTotal),
                ],
              ]}
            />

            <h1 className="mb-2 mt-3.5 text-base font-extrabold" style={{ color: E_NAVY }}>
              {isTurnkey ? '3. Kaufpreisbasis' : '3. Weitere CAPEX-Positionen'}
            </h1>
            <ETable
              head={['Position', 'Betrag (EUR)']}
              rows={other.map((p) => [p.name, eur(p.cost)])}
              totalRow={['Gesamt-CAPEX', eur(calc.totalCapex)]}
            />
            <div className="mt-1.5 text-right text-[9.5px] font-extrabold" style={{ color: E_NAVY }}>
              Spezifische Investkosten: {eurKwp(calc.specificCapex)}
            </div>
          </div>
          <PageFooter page={2} />
        </div>

        {/* ===== PAGE 3 ===== */}
        <div className="expose-page" style={pageStyle}>
          <PageHeader projektname={project.projektname} />
          <div style={{ marginTop: '12mm' }}>
            <h1 className="mb-2 text-base font-extrabold" style={{ color: E_NAVY }}>
              4. Cashflow- und Renditeanalyse
            </h1>
            <p className="mb-2 text-[9.5px] leading-relaxed">
              Projektion der jährlichen freien Cashflows über {calc.years.length - 1} Jahre,
              basierend auf Energieertrag, Strompreisentwicklung und laufenden Betriebskosten.
              Steuer-, Finanzierungs- und Abschreibungseffekte sowie ein Restwert sind nicht enthalten.
            </p>

            <h2 className="mb-1 mt-2.5 text-[11.5px] font-extrabold" style={{ color: E_NAVY }}>
              Jährlicher freier Cashflow (Jahr 1–{calc.years.length - 1}, EUR)
            </h2>
            <MiniBarChart values={cfs} />

            <h2 className="mb-1 mt-2.5 text-[11.5px] font-extrabold" style={{ color: E_NAVY }}>
              Kumulierter Cashflow inkl. Investition (EUR)
            </h2>
            <CumulativeChart values={cum} />

            <h2 className="mb-1 mt-2.5 text-[11.5px] font-extrabold" style={{ color: E_NAVY }}>
              Wesentliche Renditekennzahlen
            </h2>
            <ETable
              head={['Kennzahl', 'Wert', 'Erläuterung']}
              rows={[
                ['Gesamt-CAPEX', eur(calc.totalCapex), 'Gesamtinvestition zum Projektstart (Jahr 0)'],
                ['Projekt-IRR', pct1(calc.irr), 'Interner Zinsfuß vor Steuern und Finanzierung'],
                ['NPV (Kapitalwert)', eur(calc.npv), `Bei WACC = ${num(project.waccPct, 1)} %`],
                [
                  'Statischer Payback',
                  calc.staticPayback ? num(calc.staticPayback, 1) + ' Jahre' : '–',
                  'Zeit bis zur vollständigen Amortisation (Jahr-1-Cashflow)',
                ],
                [
                  'Dynamischer Payback',
                  calc.dynPayback !== null ? num(calc.dynPayback, 1) + ' Jahre' : '–',
                  `Diskontierte Amortisation bei ${num(project.waccPct, 1)} % WACC`,
                ],
                ['CF Jahr 1', eur(calc.years[1].ncf), 'Freier Cashflow im ersten Betriebsjahr'],
                [
                  `CF Jahr ${calc.years.length - 1}`,
                  eur(calc.years[calc.years.length - 1].ncf),
                  'Freier Cashflow im letzten Betriebsjahr',
                ],
              ]}
            />

            <h1 className="mb-2 mt-3 text-base font-extrabold" style={{ color: E_NAVY }}>
              5. Annahmen & Methodik
            </h1>
            <p className="mb-2 text-[9.5px] leading-relaxed">
              Spezifischer Jahresertrag {num(project.spezErtragKwhKwp)} kWh/kWp, Modul-Degradation{' '}
              {num(project.degradationPct, 1)} % p.a., Strompreis{' '}
              {Number(project.strompreisEurKwh).toLocaleString('de-DE', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 4,
              })}{' '}
              EUR/kWh mit {num(project.strompreissteigerungPct, 1)} % jährlicher Steigerung,
              Betriebskosten {num(project.betriebskostenPct, 1)} % der Investitionssumme im Jahr 1
              mit {num(INVESTOR_OPEX_ESCALATION_PCT, 1)} % jährlicher Steigerung,
              WACC {num(project.waccPct, 1)} %.
            </p>

            <h1 className="mb-2 mt-2 text-base font-extrabold" style={{ color: E_NAVY }}>
              6. Disclaimer
            </h1>
            <p className="text-[8.5px] leading-relaxed" style={{ color: E_GREY }}>
              Dieses Exposé dient ausschließlich zu Informationszwecken und stellt kein Angebot
              und keine Aufforderung zur Abgabe eines Angebots zum Erwerb von Beteiligungen oder
              Wertpapieren dar. Alle Angaben beruhen auf aktuellen Planungsannahmen und
              Schätzungen; tatsächliche Ergebnisse können hiervon abweichen. EMA Enterprise GmbH
              übernimmt keine Gewähr für die Vollständigkeit oder Richtigkeit der dargestellten
              Informationen.
            </p>
          </div>
          <PageFooter page={3} />
        </div>
      </div>
    </div>
  )
}
