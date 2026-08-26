import { BESS_DD_CHECKLIST, evaluateBessDueDiligence, type BessDdItem } from '@/lib/due-diligence/bess'

export default async function DueDiligencePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // Phase 1 deliberately starts conservative: nothing is treated as verified without evidence.
  const items: BessDdItem[] = BESS_DD_CHECKLIST.map(item => ({ ...item, status: 'open' }))
  const result = evaluateBessDueDiligence(items)
  const categories = Array.from(new Set(items.map(item => item.category)))

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 pb-28">
      <header className="rounded-3xl border border-white/10 bg-slate-950 p-6 text-white shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-lime-400">EMA AI · Investment Due Diligence</p>
        <h1 className="mt-2 text-3xl font-bold">BESS Due Diligence</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">Projekt {id}: belastbare Prüfung statt schöner Score. Aussagen gelten erst als verifiziert, wenn ein Nachweis vorhanden ist.</p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Investment Readiness" value={`${result.readinessScore}%`} />
        <Metric label="RTB Score" value={`${result.rtbScore}%`} />
        <Metric label="Hard Gates" value={result.hardGatesPassed ? 'Bestanden' : 'Offen'} />
        <Metric label="Entscheidung" value={result.recommendation} />
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Datenraum & Nachweise</h2>
        <p className="mt-1 text-sm text-slate-600">Bestehende Projektdokumente können als Quellen für die DD verwendet werden. Upload und Dokumentenverwaltung bleiben im vorhandenen Projektdatenraum.</p>
        <a href={`/projects/${id}/documents`} className="mt-4 inline-flex rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Datenraum öffnen</a>
      </section>

      <section className="space-y-4">
        {categories.map(category => (
          <div key={category} className="rounded-3xl border bg-white p-5 shadow-sm">
            <h2 className="font-bold text-slate-900">{category}</h2>
            <div className="mt-3 divide-y">
              {items.filter(item => item.category === category).map(item => (
                <div key={item.id} className="flex items-start justify-between gap-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{item.label}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.hardGate ? 'Hard Gate · ' : ''}Gewichtung {item.weight}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">Offen</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
        <h2 className="font-bold text-amber-950">EMA AI Fazit</h2>
        <p className="mt-2 text-sm text-amber-900">Noch keine Investitionsfreigabe. Die DD startet bewusst bei 0 %, bis Dokumente und Projektwerte als Evidenz zugeordnet und geprüft wurden.</p>
      </section>
    </main>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold text-slate-950">{value}</p></div>
}
