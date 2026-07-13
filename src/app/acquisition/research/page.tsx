import Link from 'next/link'
import { ArrowLeft, Building2, Clock3, FolderSearch2, Inbox, MapPinned, RotateCcw, Search, ShieldCheck, Sparkles } from 'lucide-react'
import { queueResearchCandidate } from '@/lib/actions/research-inbox.actions'
import { runOpenStreetMapResearch } from '@/lib/actions/osm-research.actions'
import { ResearchProgressButton } from '@/components/acquisition/ResearchProgressForm'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type SearchHistory = {
  id: string
  location: string
  radius_km: number
  category: 'all' | 'logistics' | 'industry'
  found_count: number
  added_count: number
  status: 'success' | 'failed'
  last_searched_at: string
}

function Field({ label, name, type = 'text', placeholder }: { label: string; name: string; type?: string; placeholder?: string }) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input name={name} type={type} placeholder={placeholder} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#5CB800] focus:ring-2 focus:ring-[#5CB800]/15" />
    </label>
  )
}

function categoryLabel(category: SearchHistory['category']) {
  if (category === 'logistics') return 'Logistik und Lager'
  if (category === 'industry') return 'Industrie'
  return 'Alle Gewerbestandorte'
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Berlin',
  }).format(new Date(value))
}

export default async function ResearchPage({ searchParams }: { searchParams: { error?: string; searched?: string; found?: string; added?: string } }) {
  const supabase = await createClient()
  const db = supabase as any
  const { data: { user } } = await supabase.auth.getUser()

  let recentSearches: SearchHistory[] = []
  if (user) {
    const { data } = await db
      .from('acquisition_research_searches')
      .select('id, location, radius_km, category, found_count, added_count, status, last_searched_at')
      .eq('user_id', user.id)
      .order('last_searched_at', { ascending: false })
      .limit(6)
    recentSearches = (data || []) as SearchHistory[]
  }

  const errorMessage = searchParams.error === 'missing'
    ? 'Bitte mindestens Firma und Akquise-Art ausfüllen.'
    : searchParams.error === 'location'
      ? 'Der eingegebene Ort konnte nicht gefunden werden.'
      : searchParams.error === 'search'
        ? 'Die öffentliche Suchquelle ist gerade nicht erreichbar. Die Suche wurde gespeichert und kann später erneut gestartet werden.'
        : searchParams.error
          ? 'Die Recherche konnte nicht abgeschlossen werden.'
          : null

  const found = Number(searchParams.found || '0')
  const added = Number(searchParams.added || '0')
  const skipped = Math.max(found - added, 0)

  return (
    <div className="min-h-screen bg-[#F4F6F9] px-4 py-6 pb-44 md:px-8 md:py-8 md:pb-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <Link href="/acquisition" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-[#132060]"><ArrowLeft className="h-4 w-4" /> Zurück zum Akquise-Center</Link>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#5CB800]"><Search className="h-4 w-4" /> EMA Scout Recherche</div>
            <h1 className="text-3xl font-semibold tracking-tight text-[#132060]">Neue Chancen recherchieren</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Öffentliche Standortdaten werden automatisch durchsucht und zunächst nur als Vorschläge ins Recherche-Postfach gelegt.</p>
          </div>
          <a href="/acquisition/research/inbox" className="inline-flex touch-manipulation items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-[#132060] shadow-sm"><Inbox className="h-4 w-4" /> Recherche-Postfach</a>
        </div>

        {errorMessage && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{errorMessage}</div>}
        {searchParams.searched && (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-green-900">
            <p className="font-semibold">Web-Recherche abgeschlossen</p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-white/80 p-3"><p className="text-2xl font-bold text-[#132060]">{found}</p><p className="text-xs text-slate-500">Gefunden</p></div>
              <div className="rounded-xl bg-white/80 p-3"><p className="text-2xl font-bold text-[#5CB800]">{added}</p><p className="text-xs text-slate-500">Neu gespeichert</p></div>
              <div className="rounded-xl bg-white/80 p-3"><p className="text-2xl font-bold text-amber-700">{skipped}</p><p className="text-xs text-slate-500">Dubletten</p></div>
            </div>
          </div>
        )}

        <section className="rounded-2xl border border-[#5CB800]/30 bg-white p-5 shadow-sm md:p-7">
          <div className="flex items-start gap-3"><div className="rounded-xl bg-green-50 p-3 text-[#5CB800]"><MapPinned className="h-5 w-5" /></div><div><h2 className="font-semibold text-[#132060]">Automatische Standortsuche</h2><p className="mt-1 text-sm leading-6 text-slate-500">Sucht kostenlos über OpenStreetMap und Overpass nach Industrie-, Lager- und Gewerbestandorten.</p></div></div>
          <form action={runOpenStreetMapResearch} className="mt-5 grid gap-4 md:grid-cols-[1fr_180px_220px_auto] md:items-end">
            <Field label="Ort oder PLZ" name="location" placeholder="z. B. Worms oder 67547" />
            <label className="space-y-2"><span className="text-sm font-medium text-slate-700">Radius</span><select name="radius_km" defaultValue="10" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#5CB800]"><option value="5">5 km</option><option value="10">10 km</option><option value="20">20 km</option><option value="30">30 km</option><option value="50">50 km</option></select></label>
            <label className="space-y-2"><span className="text-sm font-medium text-slate-700">Standorttyp</span><select name="category" defaultValue="all" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#5CB800]"><option value="all">Alle Gewerbestandorte</option><option value="logistics">Logistik und Lager</option><option value="industry">Industrie</option></select></label>
            <ResearchProgressButton />
          </form>
          <p className="mt-3 text-xs leading-5 text-slate-400">Maximal 30 neue Vorschläge pro Suche. Öffentliche Daten können unvollständig sein und müssen vor einer Kontaktaufnahme geprüft werden.</p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[#EEF2F7] p-3 text-[#132060]"><Clock3 className="h-5 w-5" /></div>
            <div><h2 className="font-semibold text-[#132060]">Letzte Suchen</h2><p className="mt-1 text-sm text-slate-500">Gespeicherte Suchkombinationen mit einem Tipp erneut starten.</p></div>
          </div>

          {recentSearches.length ? (
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {recentSearches.map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[#132060]">{item.location}</p>
                      <p className="mt-1 text-sm text-slate-500">{item.radius_km} km · {categoryLabel(item.category)}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-800'}`}>
                      {item.status === 'success' ? 'Erfolgreich' : 'Quelle nicht erreichbar'}
                    </span>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3 text-xs text-slate-500">
                    <span>{formatDate(item.last_searched_at)} Uhr</span>
                    <span>{item.found_count} gefunden · {item.added_count} neu</span>
                  </div>
                  <form action={runOpenStreetMapResearch} className="mt-4">
                    <input type="hidden" name="location" value={item.location} />
                    <input type="hidden" name="radius_km" value={item.radius_km} />
                    <input type="hidden" name="category" value={item.category} />
                    <button type="submit" className="inline-flex w-full touch-manipulation items-center justify-center gap-2 rounded-xl border border-[#132060]/15 bg-white px-4 py-3 text-sm font-semibold text-[#132060] shadow-sm active:scale-[0.99]">
                      <RotateCcw className="h-4 w-4" /> Erneut starten
                    </button>
                  </form>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-400">Nach deiner nächsten Suche erscheint sie automatisch hier.</div>
          )}
        </section>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <form action={queueResearchCandidate} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
            <section className="space-y-4">
              <div><h2 className="font-semibold text-[#132060]">Treffer manuell ergänzen</h2><p className="mt-1 text-xs text-slate-400">Pflichtfelder sind Firma und Akquise-Art.</p></div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2"><span className="text-sm font-medium text-slate-700">Akquise-Art</span><select name="acquisition_type" required className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#5CB800]"><option value="roof">Große Dachfläche</option><option value="project">PV-, BESS- oder Hybridprojekt</option></select></label>
                <Field label="Firmenname" name="company_name" placeholder="z. B. Muster Logistik GmbH" />
                <Field label="Website" name="website" placeholder="www.beispiel.de" />
                <Field label="Öffentliche E-Mail" name="email" type="email" placeholder="info@beispiel.de" />
                <Field label="Ansprechpartner" name="contact_name" placeholder="Vor- und Nachname" />
                <Field label="Funktion" name="contact_role" placeholder="z. B. Geschäftsführer" />
              </div>
            </section>
            <section className="space-y-4 border-t border-slate-100 pt-6">
              <h2 className="font-semibold text-[#132060]">Standort und Potenzial</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Ort" name="city" /><Field label="Bundesland" name="state" /><Field label="Dachfläche in m²" name="estimated_roof_area_sqm" type="number" /><Field label="Geschätztes Potenzial in kWp" name="estimated_potential_kwp" type="number" /><Field label="Projektart" name="project_type" placeholder="PV, BESS oder Hybrid" /><Field label="Projektstand" name="project_stage" placeholder="z. B. baureif, Netzzusage" />
              </div>
            </section>
            <section className="space-y-4 border-t border-slate-100 pt-6">
              <h2 className="font-semibold text-[#132060]">Recherchequelle</h2>
              <div className="grid gap-4 md:grid-cols-2"><Field label="Quellenname" name="source_name" placeholder="z. B. Unternehmenswebsite" /><Field label="Quellen-URL" name="source_url" placeholder="https://…" /></div>
              <label className="block space-y-2"><span className="text-sm font-medium text-slate-700">Fundstelle und Notizen</span><textarea name="notes" rows={5} placeholder="Warum ist dieser Treffer interessant? Welche Informationen fehlen noch?" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#5CB800] focus:ring-2 focus:ring-[#5CB800]/15" /></label>
            </section>
            <button className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#132060] px-5 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-[#1F2A44]"><Sparkles className="h-4 w-4" /> Bewerten und ins Recherche-Postfach legen</button>
          </form>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><div className="rounded-xl bg-green-50 p-3 text-[#5CB800]"><ShieldCheck className="h-5 w-5" /></div><div><h3 className="font-semibold text-[#132060]">Dubletten-Schutz</h3><p className="mt-1 text-xs leading-5 text-slate-500">Prüft Firmenname, E-Mail, Website und die öffentliche Fundstelle.</p></div></div></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><div className="rounded-xl bg-[#EEF2F7] p-3 text-[#132060]"><Building2 className="h-5 w-5" /></div><div><h3 className="font-semibold text-[#132060]">Dachflächen-Fokus</h3><p className="mt-1 text-xs leading-5 text-slate-500">Industrie-, Lager- und Gewerbegebäude werden als mögliche PV-Dachflächen priorisiert.</p></div></div></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><div className="rounded-xl bg-[#EEF2F7] p-3 text-[#132060]"><FolderSearch2 className="h-5 w-5" /></div><div><h3 className="font-semibold text-[#132060]">Öffentliche Daten</h3><p className="mt-1 text-xs leading-5 text-slate-500">Website und E-Mail werden nur übernommen, wenn sie öffentlich in der Quelle hinterlegt sind.</p></div></div></div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"><p className="font-semibold">Kontrollierter Prozess</p><p className="mt-2 text-xs leading-5">Treffer landen nur im Recherche-Postfach. Erst deine Bestätigung erzeugt einen Lead. E-Mails bleiben freigabepflichtig.</p></div>
          </aside>
        </div>
      </div>
    </div>
  )
}
