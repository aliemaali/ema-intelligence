'use client'

import { Download, Printer } from 'lucide-react'

export function PrintButton() {
  const print = () => window.print()

  return (
    <div className="print:hidden flex flex-wrap gap-3">
      <button onClick={print} className="inline-flex items-center gap-2 rounded-2xl bg-[#5CB800] px-5 py-3 text-sm font-extrabold text-white shadow-lg shadow-[#5CB800]/20 transition hover:-translate-y-0.5 hover:bg-[#4EA000]">
        <Download className="h-4 w-4" /> Als PDF speichern
      </button>
      <button onClick={print} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-extrabold text-[#0B1633] shadow-sm transition hover:bg-slate-50">
        <Printer className="h-4 w-4" /> Drucken
      </button>
    </div>
  )
}
