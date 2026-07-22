import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getDocuments } from '@/lib/actions/document.actions'
import { DocumentUploader } from '@/components/projects/DocumentUploader'
import { DocumentList } from '@/components/projects/DocumentList'
import { ProjectDocumentChecklist } from '@/components/projects/ProjectDocumentChecklist'
import { EmptyState } from '@/components/ui'

interface DocumentsTabProps {
  params: { id: string }
}

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
  return (value ?? '')
    .toLocaleLowerCase('de-DE')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
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
    supabase
      .from('projects')
      .select('project_type')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('project_document_checklists')
      .select('document_type, status')
      .eq('project_id', params.id)
      .eq('user_id', user.id),
  ])

  if (!project) redirect('/projects')

  const checklistMap = new Map((checklistRows ?? []).map((row: any) => [row.document_type, row.status]))
  const definitions = project.project_type === 'pv_dach' ? ROOF_ITEMS : DEFAULT_ITEMS
  const checklistItems = definitions.map((item) => ({
    ...item,
    status: (checklistMap.get(item.type) ?? null) as 'vorhanden' | 'fehlt' | 'nicht_erforderlich' | null,
    autoDetected: autoDetected(item.type, documents as any),
  }))

  return (
    <div className="py-4 space-y-5 max-w-2xl">
      <ProjectDocumentChecklist
        projectId={params.id}
        userId={user.id}
        items={checklistItems}
      />

      <div className="card-padded">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Dokument hochladen
        </h3>
        <DocumentUploader projectId={params.id} userId={user.id} />
      </div>

      {documents.length === 0 ? (
        <EmptyState
          icon="📎"
          title="Noch keine Dokumente"
          description="Lade Exposés, Lagepläne, Netzanschlussdokumente und mehr hoch."
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {documents.length} Dokument{documents.length !== 1 ? 'e' : ''}
            </span>
          </div>
          <DocumentList documents={documents} projectId={params.id} />
        </div>
      )}
    </div>
  )
}
