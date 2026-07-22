import { NextRequest, NextResponse } from 'next/server'
import { clearMicrosoftSession } from '@/lib/microsoft/session'

export async function GET(request: NextRequest) {
  clearMicrosoftSession()
  return NextResponse.redirect(new URL('/microsoft?disconnected=1', request.url))
}
