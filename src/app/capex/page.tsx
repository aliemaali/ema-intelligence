// src/app/capex/page.tsx
import { getProjectOptions } from '@/lib/actions/capex.actions'
import { CapexProjectPicker } from '@/components/capex/CapexProjectPicker'
import { TopHeader } from '@/components/layout/TopHeader'

export default async function CapexIndexPage() {
  const projects = await getProjectOptions()

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f5f9f2] via-[#f7f9fc] to-white">
      <TopHeader />
      <CapexProjectPicker projects={projects} />
    </div>
  )
}
