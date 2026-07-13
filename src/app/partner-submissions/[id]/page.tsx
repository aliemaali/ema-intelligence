import Link from 'next/link'
import { ArrowLeft, Download, ExternalLink, FileText, MapPin } from 'lucide-react'
import { notFound, redirect } from 'next/navigation'
import { updatePartnerSubmissionReview } from '@/lib/actions/partner-submission-review.actions'
import { createClient } from '@/lib/supabase/server'

const TYPE_LABELS: Record<string, string> = {
  pv_freiflaeche: 'PV-Freifläche',
  pv_dach: 'PV-Dach',
  bess: 'BESS',
  hybrid: 'Hybrid',
}

export default async function PartnerSubmissionDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: submission } = await supabase
    .from('project_submissions')
    .select('*')
    .eq('id', params.id)
    .maybeSingle()

  if (!submission) notFound()

  const [{ data: partner }, { data: documents }] = await Promise.all([
    supabase.from('profiles').select('full_name, company, email, phone').eq('id', submission.partner_user_id).maybeSingle(),
    supabase.from('submission_documents').select('*').eq('submission_id', submission.id).order('created_at'),
  ])

  const documentsWithLinks = await Promise.all((documents ?? []).map(async (document: any) => {
    const { data } = await supabase.storage.from('partner-submissions').createSignedUrl(document.file_path, 3600)
    return { ...document, signedUrl: data?.signedUrl ?? null }
  }))

  const osmUrl = submission.location_lat && submission.location_lng
    ? `https://www.openstreetmap.org/?mlat=${submission.location_lat}&mlon=${submission.location_lng}#map=17/${submission.location_lat}/${submission.location_lng}`
    : null

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <Link href="/partner-submissions" className="inline-flex items-center gap-2 text-sm font-extrabold text-[#2F8A00]"><ArrowLeft className="h-4 w-4" /> Zurück zu Einreichungen</Link>

      <section className="rounded-[2rem] bg-white p-6 shadow-sm md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.15em] text-[#2F8A00]">{TYPE_LABELS[submission.project_type] ?? submission.project_type}</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[#07142F]">{submission.project_name}</h1>
            <p className="mt-2 text-sm text-muted-foreground">Eingereicht von {partner?.company || partner?.full_name || partner?.email || 'Vertriebspartner'}</p>
          </div>
          <span className="rounded-full bg-[#1F2A44]/8 px-3 py-1.5 text-sm font-extrabold text-[#1F2A44]">{submission.status}</span>
        </div>

        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Info label="Standort" value={[submission.location_address, submission.location_city, submission.location_state].filter(Boolean).join(', ')} />
          <Info label="PV-Leistung" value={submission.pv_kwp ? `${Number(submission.pv_kwp).toLocaleString('de-DE')} kWp` : '–'} />
          <Info label="BESS" value={submission.bess_mwh ? `${submission.bess_mw ?? '–'} MW / ${submission.bess_mwh} MWh` : '–'} />
          <Info label="Vermarktung" value={String(submission.remuneration_model ?? '–').replace('_', ' ')} />
          <Info label="Vergütung" value={submission.remuneration_ct_kwh != null ? `${submission.remuneration_ct_kwh} ct/kWh` : '–'} />
          <Info label="PPA-Laufzeit" value={submission.ppa_term_years ? `${submission.ppa_term_years} Jahre` : '–'} />
        </div>

        {osmUrl && <a href={osmUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-extrabold text-[#1F2A44]"><MapPin className="h-4 w-4" /> Standort auf Karte öffnen <ExternalLink className="h-4 w-4" /></a>}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[2rem] bg-white p-6 shadow-sm">
          <h2 className="text-xl font-extrabold text-[#07142F]">Unterlagen</h2>
          <div className="mt-4 space-y-3">
            {documentsWithLinks.length === 0 && <p className="rounded-2xl bg-slate-50 p-4 text-sm text-muted-foreground">Keine Dokumente hochgeladen.</p>}
            {documentsWithLinks.map((document: any) => (
              <div key={document.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4">
                <FileText className="h-5 w-5 shrink-0 text-[#2F8A00]" />
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-extrabold">{document.display_name}</p><p className="text-xs text-muted-foreground">{document.document_type}</p></div>
                {document.signedUrl && <a href={document.signedUrl} target="_blank" rel="noreferrer" className="rounded-xl p-2 text-[#1F2A44]" aria-label="Dokument öffnen"><Download className="h-5 w-5" /></a>}
              </div>
            ))}
          </div>
        </div>

        <form action={updatePartnerSubmissionReview} className="rounded-[2rem] bg-white p-6 shadow-sm">
          <input type="hidden" name="submission_id" value={submission.id} />
          <h2 className="text-xl font-extrabold text-[#07142F]">Prüfung</h2>
          <label className="mt-5 block"><span className="text-sm font-bold">Status</span><select name="status" defaultValue={submission.status} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3"><option value="eingereicht">Eingereicht</option><option value="in_pruefung">In Prüfung</option><option value="rueckfrage">Rückfrage</option><option value="angenommen">Angenommen</option><option value="abgelehnt">Abgelehnt</option></select></label>
          <label className="mt-4 block"><span className="text-sm font-bold">Rückfrage / interne Mitteilung</span><textarea name="review_note" defaultValue={submission.review_note ?? ''} rows={7} className="mt-2 w-full resize-y rounded-2xl border border-slate-200 px-4 py-3" placeholder="Fehlende Unterlagen oder Rückfrage an den Partner …" /></label>
          <button type="submit" className="mt-5 min-h-12 w-full rounded-2xl bg-[#5CB800] px-5 py-3 font-extrabold text-white">Prüfung speichern</button>
        </form>
      </section>

      {(submission.notes || partner?.email || partner?.phone) && (
        <section className="rounded-[2rem] bg-white p-6 shadow-sm">
          <h2 className="text-xl font-extrabold text-[#07142F]">Kontakt und Hinweise</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2"><Info label="Partner" value={[partner?.full_name, partner?.company].filter(Boolean).join(' · ') || '–'} /><Info label="Kontakt" value={[partner?.email, partner?.phone].filter(Boolean).join(' · ') || '–'} /></div>
          {submission.notes && <p className="mt-5 whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">{submission.notes}</p>}
        </section>
      )}
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-sm font-extrabold text-[#1F2A44]">{value || '–'}</p></div>
}
