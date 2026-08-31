// src/app/capex/page.tsx
import { getProjectOptions } from '@/lib/actions/capex.actions'
import { CapexProjectPicker } from '@/components/capex/CapexProjectPicker'
import { TopHeader } from '@/components/layout/TopHeader'

export default async function CapexIndexPage() {
  const projects = await getProjectOptions()

  return (
    <div className="premium-page min-h-screen">
      <TopHeader />
      <CapexProjectPicker projects={projects} />
    </div>
  )
}
