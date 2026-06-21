// src/app/capex/page.tsx
import { getProjectOptions } from '@/lib/actions/capex.actions'
import { CapexProjectPicker } from '@/components/capex/CapexProjectPicker'

export default async function CapexIndexPage() {
  const projects = await getProjectOptions()
  return <CapexProjectPicker projects={projects} />
}
