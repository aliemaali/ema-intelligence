'use client'

import dynamic from 'next/dynamic'

const ProjectImportUploader = dynamic(
  () => import('./ProjectImportUploaderV2').then((mod) => mod.ProjectImportUploaderV2),
  {
    ssr: false,
    loading: () => (
      <div className="card-padded rounded-[2rem]">
        <p className="text-sm font-bold text-muted-foreground">Projekt-Import wird geladen ...</p>
      </div>
    ),
  }
)

export function ProjectImportClient() {
  return <ProjectImportUploader />
}
