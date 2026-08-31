import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function errorResponse(message: string, status: number) {
  return new Response(message, {
    status,
    headers: {
      'Cache-Control': 'private, no-store',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  })
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirectTo', '/dms')
    return NextResponse.redirect(loginUrl)
  }

  const { data: document, error: documentError } = await (supabase as any)
    .from('documents')
    .select('storage_bucket, file_path')
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('is_archived', false)
    .maybeSingle()

  if (documentError || !document) {
    console.error('[dms:open] document lookup failed', {
      documentId: id,
      error: documentError?.message ?? 'not-found',
    })
    return errorResponse('Dokument nicht gefunden.', 404)
  }

  const { data, error: signedError } = await supabase.storage
    .from(document.storage_bucket)
    .createSignedUrl(document.file_path, 3600)

  if (signedError || !data?.signedUrl) {
    console.error('[dms:open] signed URL failed', {
      documentId: id,
      bucket: document.storage_bucket,
      error: signedError?.message ?? 'missing-signed-url',
    })
    return errorResponse('Dokument konnte nicht geöffnet werden.', 502)
  }

  const response = NextResponse.redirect(data.signedUrl)
  response.headers.set('Cache-Control', 'private, no-store')
  return response
}
