'use server'

import { createClient } from '@/lib/supabase/server'

const BUCKET_NAME = 'project-imports'

function sanitizeFileName(name: string) {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}

export async function uploadProjectImportFiles(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: 'Nicht angemeldet. Bitte neu einloggen.' }
  }

  const files = formData
    .getAll('files')
    .filter((value): value is File => value instanceof File && value.size > 0)

  if (files.length === 0) {
    return { error: 'Keine Datei ausgewählt.' }
  }

  const importId = crypto.randomUUID()
  const uploaded: Array<{
    name: string
    size: number
    type: string
    path: string
  }> = []

  for (const file of files) {
    const safeName = sanitizeFileName(file.name || 'import-datei')
    const path = `${user.id}/imports/${importId}/${Date.now()}-${safeName}`

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || 'application/octet-stream',
      })

    if (error) {
      return {
        error: `Upload fehlgeschlagen: ${error.message}`,
        uploaded,
      }
    }

    uploaded.push({
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      path,
    })
  }

  return {
    success: true,
    importId,
    bucket: BUCKET_NAME,
    uploaded,
  }
}
