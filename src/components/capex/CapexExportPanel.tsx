// src/components/capex/CapexExportPanel.tsx
'use client'

import { useState } from 'react'
import type { CapexCalcResult, CapexProject } from '@/lib/types/capex.types'

interface CapexExportPanelProps {
  project: CapexProject
  calc: CapexCalcResult
}

function buildExportObject(project: CapexProject, calc: CapexCalcResult) {
  return {
    meta: {
      exportedAt: new Date().toISOString(),
      source: 'EMA CAPEX PV – Formular',
      version: 1,
    },
    projektparameter: {
      projektname: project.projektname,
      anlagenleistungKwp: Number(project.anlagenleistungKwp) || 0,
      spezErtragKwhKwp: Number(project.spezErtragKwhKwp) || 0,
      strompreisEurKwh: Number(project.strompreisEurKwh) || 0,
      degradationPct: Number(project.degradationPct) || 0,
      betriebskostenPct: Number(project.betriebskostenPct) || 0,
      pachtdauerJahre: Number(project.pachtdauerJahre) || 0,
    },
    kalkulation: {
      module: {
        modulleistungWp: Number(project.modulleistungWp) || 0,
        preisProModul: Number(project.preisProModul) || 0,
      },
      wechselrichter: {
        hersteller: project.wrHersteller,
        einzelpreisEur: Number(project.wrEinzelpreis) || 0,
        anzahl: Number(project.wrAnzahl) || 0,
      },
      unterkonstruktion: {
        hersteller: project.ukHersteller,
        preisProKwp: Number(project.ukPreisProKwp) || 0,
      },
      dcAcInstallation: {
        dcPreisProKwp: Number(project.dcPreisProKwp) || 0,
        acPreisProKwp: Number(project.acPreisProKwp) || 0,
      },
    },
    weitereCapexPositionen: {
      planungEngineering: Number(project.planungEngineering) || 0,
      baulicheMassnahmen: Number(project.baulicheMassnahmen) || 0,
      logistikTransport: Number(project.logistikTransport) || 0,
      inbetriebnahme: Number(project.inbetriebnahme) || 0,
      contingency: Number(project.contingency) || 0,
      pachtzahlungProKwp: Number(project.pachtzahlungProKwp) || 0,
      projektrechteProKwp: Number(project.projektrechteProKwp) || 0,
    },
    cashflowAnnahmen: {
      strompreissteigerungPct: Number(project.strompreissteigerungPct) || 0,
      waccPct: Number(project.waccPct) || 0,
    },
    berechnetVorschau: {
      gesamtCapex: Math.round(calc.totalCapex),
      spezifischeInvestkosten: Math.round(calc.specificCapex),
      irr: Math.round(calc.irr * 1000) / 1000,
      npv: Math.round(calc.npv),
      statischerPaybackJahre: calc.staticPayback ? Math.round(calc.staticPayback * 10) / 10 : null,
    },
  }
}

export function CapexExportPanel({ project, calc }: CapexExportPanelProps) {
  const [toast, setToast] = useState('')
  const exportText = JSON.stringify(buildExportObject(project, calc), null, 2)

  async function copyExport() {
    try {
      await navigator.clipboard.writeText(exportText)
      setToast('In Zwischenablage kopiert')
    } catch {
      setToast('Kopieren fehlgeschlagen – bitte manuell markieren')
    }
    setTimeout(() => setToast(''), 2000)
  }

  return (
    <div className="relative mt-3.5">
      <div className="mb-2.5 text-[12.5px] leading-relaxed text-slate-600">
        Kopiere diesen Daten-Export und sende ihn im Chat an Claude, um ein PDF-Exposé zu
        erstellen.
      </div>
      <textarea
        readOnly
        value={exportText}
        className="h-80 w-full rounded-lg border border-slate-300 bg-white p-2.5 font-mono text-[11px]"
      />
      <button
        onClick={copyExport}
        className="mt-2.5 w-full rounded-lg bg-[#5CB800] py-3.5 text-sm font-extrabold text-white"
      >
        In Zwischenablage kopieren
      </button>
      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-[#1F2A44] px-[18px] py-2.5 text-[13px] font-semibold text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
