import Image from 'next/image'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, FileArchive } from 'lucide-react'
import { DueDiligenceWorkspace } from '@/components/dms/DueDiligenceWorkspace'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'EMA DD-Datenraum' }
export const dynamic = 'force-dynamic'

export default async function DataRoomPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?redirectTo=/dms/data-rooms/${params.id}`)

  const { data: room } = await (supabase as any).from('dms_data_rooms').select('id, name, project_id, project_profile, status, file_count, total_uncompressed_bytes, error_message, created_at').eq('id', params.id).eq('user_id', user.id).maybeSingle()
  if (!room) notFound()

  const [{ data: links }, { data: reports }] = await Promise.all([
    (supabase as any).from('dms_data_room_documents').select('document_id, archive_entry_path').eq('data_room_id', room.id).eq('user_id', user.id).order('created_at'),
    (supabase as any).from('dms_due_diligence_reports').select('assessment, report_document_id, status, created_at').eq('data_room_id', room.id).eq('user_id', user.id).eq('status', 'completed').order('created_at', { ascending: false }).limit(1),
  ])
  const ids = (links ?? []).map((link: any) => link.document_id)
  const { data: documentRows } = ids.length
    ? await (supabase as any).from('documents').select('id, display_name, file_name, mime_type, ai_analyzed, analysis_status').in('id', ids).eq('user_id', user.id).eq('is_archived', false)
    : { data: [] }
  const pathById = new Map((links ?? []).map((link: any) => [link.document_id, link.archive_entry_path]))
  const documents = (documentRows ?? []).map((document: any) => ({ ...document, archive_entry_path: pathById.get(document.id) || document.file_name }))
  const latest = reports?.[0] ?? null

  return <main className="min-h-screen bg-[radial-gradient(circle_at_5%_18%,rgba(92,184,0,.12),transparent_24%),linear-gradient(145deg,#edf3f7_0%,#f8fafc_52%,#eef4fb_100%)] px-3 pb-10 pt-[calc(env(safe-area-inset-top)+1rem)] md:px-7 md:py-7"><div className="mx-auto max-w-[1280px]"><header className="mb-5 rounded-[2rem] bg-[#06162f] p-5 text-white shadow-[0_25px_70px_rgba(1,10,27,.24)] md:p-7"><div className="flex items-center justify-between gap-4"><Link href="/dms" className="flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-extrabold"><ArrowLeft className="h-4 w-4" /> DMS</Link><Link href="/apps" aria-label="EMA Startzentrale"><Image src="/brand/ema-mark-white.png" alt="EMA" width={506} height={247} className="h-auto w-24" /></Link></div><div className="mt-6 flex items-start gap-4"><span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#5CB800]/15 text-[#8eee51]"><FileArchive className="h-7 w-7" /></span><div><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[#8eee51]">EMA DMS · Datenraum</p><h1 className="mt-1 text-2xl font-extrabold md:text-4xl">{room.name}</h1><p className="mt-2 text-sm text-slate-300">{room.file_count} unterstützte Dateien · Prüfprofil {String(room.project_profile).toUpperCase()} · Status {room.status}</p></div></div>{room.error_message && <p className="mt-4 rounded-xl border border-red-300/20 bg-red-500/10 p-3 text-sm text-red-100">{room.error_message}</p>}</header><DueDiligenceWorkspace roomId={room.id} documents={documents} initialAssessment={latest?.assessment ?? null} initialReportDocumentId={latest?.report_document_id ?? null} /></div></main>
}
