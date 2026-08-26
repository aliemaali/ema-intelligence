import { evaluateBessDueDiligence } from '@/lib/due-diligence/bess'
import { getEvidenceCoverage, mapDocumentsToBessEvidence } from '@/lib/due-diligence/evidence'
import { getDocuments } from '@/lib/actions/document.actions'

export default async function DueDiligencePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const documents = await getDocuments(id)
  const items = mapDocumentsToBessEvidence(documents)
  const result = evaluateBessDueDiligence(items)
  const coverage = getEvidenceCoverage(items)
  const categories = Array.from(new Set(items.map(item => item.category)))

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 pb-28">
      <header className="rounded-3xl border border-white/10 bg-slate-950 p-6 text-white shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-lime-400">EMA AI · Investment Due Diligence</p>
        <h1 className="mt-2 text-3xl font-bold">BESS Due Diligence</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">EMA ordnet vorhandene Projektunterlagen möglichen Prüfpunkten zu. Ein gefundener Nachweis ist noch keine Verifizierung – erst die Inhaltsprüfung darf einen Punkt freigeben.</p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Metric label="Investment Readiness" value={`${result.readinessScore}%`} />
        <Metric label="RTB Score" value={`${result.rtbScore}%`} />
        <Metric label="Evidenz-Abdeckung" value={`${coverage.percent}%`} />
        <Metric label="Hard Gates" value={result.hardGatesPassed ? 'Bestanden' : 'Offen'} />
        <Metric label="Entscheidung" value={result.recommendation} />
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Datenraum & Evidenz-Mapping</h2>
            <p className="mt-1 text-sm text-slate-600">{documents.length} Dokument{documents.length === 1 ? '' : 'e'} im Projektdatenraum · für {coverage.withEvidence} von {coverage.total} DD-Punkten wurden mögliche Nachweise erkannt.</p>
          </div>
          <a href={`/projects/${id}/documents`} className="inline-flex rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Datenraum öffnen</a>
        </div>
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
                    {item.evidence && <p className="mt-2 text-xs font-semibold text-emerald-700">{item.evidence}</p>}
                    {item.source && <p className="mt-1 text-xs text-slate-500">Quelle: {item.source}</p>}
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${item.source ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                    {item.source ? 'Prüfung nötig' : 'Nachweis fehlt'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
        <h2 className="font-bold text-amber-950">EMA AI Fazit</h2>
        <p className="mt-2 text-sm text-amber-900">Noch keine Investitionsfreigabe. EMA hat mögliche Evidenz erkannt, wertet Dateinamen aber ausdrücklich nicht als Beweis. Der nächste Schritt ist die serverseitige Inhaltsprüfung der zugeordneten Dokumente mit Quellenbezug und Widerspruchserkennung.</p>
      </section>
    </main>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold text-slate-950">{value}</p></div>
}
