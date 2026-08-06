'use client'

import dynamic from 'next/dynamic'
import type { ProjectListSummary, ProjectMapItem } from './InternationalProjectMap'

const InternationalProjectMap = dynamic(
  () => import('./InternationalProjectMap').then((module) => module.InternationalProjectMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[380px] animate-pulse rounded-[1.45rem] border border-slate-200 bg-[#EEF1F4] md:h-[520px]" aria-label="Projektkarte wird geladen" />
    ),
  },
)

export function ProjectMap({
  projects,
  projectLists,
}: {
  projects: ProjectMapItem[]
  projectLists: ProjectListSummary[]
}) {
  return <InternationalProjectMap projects={projects} projectLists={projectLists} />
}
