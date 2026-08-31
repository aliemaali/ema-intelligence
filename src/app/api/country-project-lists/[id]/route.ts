import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function DELETE(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })

  const { data: projectList, error: readError } = await supabase
    .from('country_project_lists')
    .select('id, file_path')
    .eq('id', params.id)
    .single()

  if (readError || !projectList) {
    return NextResponse.json({ error: 'Projektliste wurde nicht gefunden.' }, { status: 404 })
  }

  const { error: storageError } = await supabase.storage
    .from('project-documents')
    .remove([projectList.file_path])

  if (storageError) {
    console.error('Projektlisten-PDF konnte nicht gelöscht werden:', storageError)
    return NextResponse.json({ error: 'Die PDF konnte nicht aus dem Speicher gelöscht werden.' }, { status: 500 })
  }

  const { error: deleteError } = await supabase
    .from('country_project_lists')
    .delete()
    .eq('id', projectList.id)

  if (deleteError) {
    console.error('Projektlisten-Datensatz konnte nicht gelöscht werden:', deleteError)
    return NextResponse.json({ error: 'Die Projektliste konnte nicht gelöscht werden.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
