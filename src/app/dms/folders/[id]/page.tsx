import Image from 'next/image'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, Files, Folder, Inbox } from 'lucide-react'
import { DmsDocumentList } from '@/components/dms/DmsDocumentList'
import { createClient } from '@/lib/supabase/server'
import type { DmsDocument, DmsFolder } from '@/lib/dms/types'

export const dynamic = 'force-dynamic'

const DOCUMENT_FIELDS = 'id, project_id, user_id, document_type, display_name, file_name, file_path, file_size_bytes, mime_type, storage_bucket, source_app, source_kind, source_record_id, sha256, folder_id, is_data_room_archive, ai_analyzed, analysis_status, is_archived, created_at'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export default async function DmsFolderPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?redirectTo=/dms/folders/${encodeURIComponent(params.id)}`)

  const isUnassigned = params.id === 'unassigned'
  const isAll = params.id === 'all'
  if (!isUnassigned && !isAll && !UUID_PATTERN.test(params.id)) notFound()

  const documentsQuery = (supabase as any)
    .from('documents')
    .select(DOCUMENT_FIELDS)
    .eq('user_id', user.id)
    .eq('is_archived', false)
    .order('created_at', { ascending: false })

  const [documentsResult, foldersResult, folderResult] = await Promise.all([
    isAll ? documentsQuery : isUnassigned ? documentsQuery.is('folder_id', null) : documentsQuery.eq('folder_id', params.id),
    (supabase as any).from('document_folders').select('id, name, parent_id').eq('user_id', user.id).order('name'),
    isUnassigned || isAll
      ? Promise.resolve({ data: null, error: null })
      : (supabase as any).from('document_folders').select('id, name, parent_id').eq('id', params.id).eq('user_id', user.id).maybeSingle(),
  ])

  if (documentsResult.error || foldersResult.error || folderResult.error) throw new Error(documentsResult.error?.message ?? foldersResult.error?.message ?? folderResult.error?.message ?? 'Ordner konnte nicht geladen werden.')
  if (!isUnassigned && !isAll && !folderResult.data) notFound()

  const documents = (documentsResult.data ?? []) as DmsDocument[]
  const folders = (foldersResult.data ?? []) as DmsFolder[]
  const title = isAll ? 'Alle Dokumente' : isUnassigned ? 'Ohne Ordner' : String(folderResult.data.name)

  return (
    <main className="dms-premium min-h-screen px-3 pb-10 pt-[calc(env(safe-area-inset-top)+1rem)] md:px-7 md:py-7">
      <div className="mx-auto max-w-[1100px]">
        <header className="dms-hero mb-5 rounded-[2rem] border border-white/10 p-5 text-white shadow-[0_25px_70px_rgba(1,10,27,.24)] md:p-7">
          <div className="flex items-center justify-between gap-4">
            <Link href="/dms" className="flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-extrabold"><ArrowLeft className="h-4 w-4" /> DMS</Link>
            <Link href="/apps" aria-label="EMA Startzentrale"><Image src="/brand/ema-mark-white.png" alt="EMA" width={506} height={247} className="h-auto w-24" /></Link>
          </div>
          <div className="mt-6 flex items-start gap-4">
            <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${isUnassigned ? 'bg-amber-400/15 text-amber-200' : 'bg-[#5CB800]/15 text-[#8eee51]'}`}>{isAll ? <Files className="h-7 w-7" /> : isUnassigned ? <Inbox className="h-7 w-7" /> : <Folder className="h-7 w-7" />}</span>
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[#8eee51]">EMA DMS · Ordner</p>
              <h1 className="mt-1 break-words text-3xl font-extrabold md:text-4xl">{title}</h1>
              <p className="mt-2 text-sm text-slate-300">{documents.length} Dokument{documents.length === 1 ? '' : 'e'} · Verschieben, umbenennen und in der Vorschau öffnen</p>
            </div>
          </div>
        </header>

        <DmsDocumentList
          documents={documents}
          folders={folders}
          heading={title}
          description={isAll ? 'Ordnerübergreifende Übersicht' : isUnassigned ? 'Noch nicht einsortierte Dokumente' : 'Dokumente in diesem Ordner'}
          emptyTitle={isAll ? 'Noch keine Dokumente vorhanden' : 'Dieser Ordner ist leer'}
          emptyText={isAll ? 'Lade dein erstes Dokument im EMA DMS hoch.' : 'Verschiebe ein Dokument über das Aktionsmenü in diesen Ordner.'}
        />
      </div>
    </main>
  )
}
