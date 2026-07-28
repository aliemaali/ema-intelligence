import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getDocuments } from '@/lib/actions/document.actions'
import { DocumentUploader } from '@/components/projects/DocumentUploader'
import { DocumentList } from '@/components/projects/DocumentList'
import { ProjectDocumentChecklist } from '@/components/projects/ProjectDocumentChecklist'
import { ProjectOutputCenter } from '@/components/projects/ProjectOutputCenter'
import type { ProjectGeneratedOutput } from '@/lib/projects/master-data'

interface DocumentsTabProps { params: { id: string } }

const ROOF_ITEMS = [
  { type: 'expose', label: 'Exposé' },
  { type: 'pvsol', label: 'PV-Sol' },
  { type: 'netzanschluss', label: 'Netzanschluss' },
  { type: 'pachtvertrag', label: 'Pachtvertrag' },
]

const DEFAULT_ITEMS = [
  { type: 'expose', label: 'Exposé' },
  { type: 'lageplan', label: 'Lageplan' },
  { type: 'netzanschluss', label: 'Netzanschluss' },
  { type: 'pachtvertrag', label: 'Pachtvertrag' },
  { type: 'genehmigung', label: 'Genehmigung' },
]

function normalize(value: string | null | undefined) {
  return (value ?? '').toLocaleLowerCase('de-DE').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
}

function autoDetected(type: string, documents: Array<{ document_type?: string | null; display_name?: string | null; file_name?: string | null }>) {
  return documents.some((document) => {
    const documentType = normalize(document.document_type)
    const text = `${normalize(document.display_name)} ${normalize(document.file_name)}`
    if (type === 'expose') return documentType === 'expose' || /\bexpose\b|projekt expos/.test(text)
    if (type === 'pvsol') return documentType === 'pvsol' || /pv sol|pvsol|ertragsprognose/.test(text)
    if (type === 'netzanschluss') return documentType === 'netzanschluss' || /netzanschluss|nvp|netzverknupfung/.test(text)
    if (type === 'pachtvertrag') return documentType === 'pachtvertrag' || /pachtvertrag|pacht vereinbarung/.test(text)
    if (type === 'lageplan') return documentType === 'lageplan' || /lageplan/.test(text)
    if (type === 'genehmigung') return documentType === 'genehmigung' || /genehmigung|baugenehmigung/.test(text)
    return documentType === type
  })
}

export default async function DocumentsTab({ params }: DocumentsTabProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [documents, { data: project }, { data: checklistRows }] = await Promise.all([
    getDocuments(params.id),
    supabase.from('projects').select('project_type, master_data_version, output_metadata').eq('id', params.id).eq('user_id', user.id).single(),
    supabase.from('project_document_checklists').select('document_type, status').eq('project_id', params.id).eq('user_id', user.id),
  ])

  if (!project) redirect('/projects')

  const checklistMap = new Map((checklistRows ?? []).map((row: any) => [row.document_type, row.status]))
  const definitions = project.project_type === 'pv_dach' ? ROOF_ITEMS : DEFAULT_ITEMS
  const checklistItems = definitions.map((item) => ({
    ...item,
    status: (checklistMap.get(item.type) ?? null) as 'vorhanden' | 'fehlt' | 'nicht_erforderlich' | null,
    autoDetected: autoDetected(item.type, documents as any),
  }))
  const outputMetadata = (project.output_metadata ?? {}) as Record<string, ProjectGeneratedOutput>

  return (
    <div className="max-w-2xl space-y-4 py-4">
      <section className="card-padded">
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#5CB800]">Erstellen</p>
        <div className="mt-3"><ProjectOutputCenter projectId={params.id} masterDataVersion={project.master_data_version} outputMetadata={outputMetadata} /></div>
      </section>

      <section className="card-padded">
        <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.16em] text-muted-foreground">Unterlagenstatus</p>
        <ProjectDocumentChecklist projectId={params.id} userId={user.id} items={checklistItems} />
      </section>

      <section className="card-padded">
        <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.16em] text-muted-foreground">Hochladen</p>
        <DocumentUploader projectId={params.id} userId={user.id} />
      </section>

      <section className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-extrabold text-[#1F2A44]">Gespeicherte Dokumente</h3>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">{documents.length}</span>
        </div>
        {documents.length > 0 ? <DocumentList documents={documents} projectId={params.id} /> : <p className="px-4 py-8 text-center text-sm text-muted-foreground">Noch keine Dokumente gespeichert.</p>}
      </section>
    </div>
  )
}
