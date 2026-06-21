import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getDocuments } from '@/lib/actions/document.actions'
import { DocumentUploader } from '@/components/projects/DocumentUploader'
import { DocumentList } from '@/components/projects/DocumentList'
import { EmptyState } from '@/components/ui'

interface DocumentsTabProps {
  params: { id: string }
}

export default async function DocumentsTab({ params }: DocumentsTabProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const documents = await getDocuments(params.id)

  return (
    <div className="py-4 space-y-5 max-w-2xl">

      {/* Upload Section */}
      <div className="card-padded">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Dokument hochladen
        </h3>
        <DocumentUploader projectId={params.id} userId={user.id} />
      </div>

      {/* Document List */}
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
