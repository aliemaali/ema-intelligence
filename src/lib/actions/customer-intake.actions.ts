'use server'

import { createProject } from '@/lib/actions/project.actions'

export async function createCustomerIntakeProject(formData: FormData): Promise<void> {
  await createProject(formData)
}
