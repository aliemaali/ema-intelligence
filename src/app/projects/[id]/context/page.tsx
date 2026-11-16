import Link from 'next/link';
import {getDocuments} from '@/lib/actions/document.actions';
import {getProject} from '@/lib/actions/project.actions';
import {ProjectConnections} from '@/components/projects/ProjectConnections';
import {DocumentList} from '@/components/projects/DocumentList';
export const dynamic='force-dynamic';
export default async function ProjectContext({params}:{params:Promise<{id:string}>}){
  const {id}=await params;await getProject(id);
  let documents:Awaited<ReturnType<typeof getDocuments>>=[];let failed=false;
  try{documents=await getDocuments(id);}catch{failed=true;}
  return <div className="max-w-3xl space-y-4 py-4"><div><h1 className="text-xl font-bold">Alles zum Projekt</h1><p className="mt-2 text-sm text-muted-foreground">E-Mails, Termine, Angebote und Unterlagen aus den gemeinsamen Quellen.</p></div>
    <ProjectConnections projectId={id}/>
    <section className="card-padded"><div className="flex flex-wrap justify-between gap-3"><h2 className="font-bold">Angebote & Dokumente</h2><Link href={`/projects/${id}/documents`} className="text-sm underline">Unterlagen öffnen →</Link></div><p className="my-3 text-xs text-muted-foreground">Office-Belege erscheinen hier nach der Ablage mit „Gemeinsames EMA-Projekt“. Geschäftsdaten und Freigaben bearbeitest du in Office.</p>
      {failed?<p role="status">Dokumente konnten nicht geladen werden. <Link className="underline" href={`/projects/${id}/context`}>Erneut versuchen</Link></p>:documents.length?<DocumentList documents={documents} projectId={id} emaKnowledgeEnabled={false}/>:<p className="text-sm text-muted-foreground">Noch keine Dokumente zugeordnet.</p>}
      <a className="mt-4 inline-block text-sm underline" href="/office">EMA Office öffnen →</a>
    </section>
  </div>;
}
