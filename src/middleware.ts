import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PARTNER_ROLES = new Set(['partner', 'sales_partner', 'vertriebspartner'])

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options: any }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  const isPartnerRoute = pathname === '/partner' || pathname.startsWith('/partner/')
  const isInternalRoute =
    pathname.startsWith('/dashboard') || pathname.startsWith('/projects') ||
    pathname.startsWith('/deals') || pathname.startsWith('/partners') ||
    pathname.startsWith('/partner-submissions') || pathname.startsWith('/partner-management') ||
    pathname.startsWith('/investors') || pathname.startsWith('/tasks') ||
    pathname.startsWith('/settings') || pathname.startsWith('/ai') || pathname.startsWith('/expose')

  const isProtectedRoute = isInternalRoute || isPartnerRoute
  const isAuthRoute = pathname.startsWith('/login')

  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(url)
  }

  let isPartner = false
  let isActive = true
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('role, is_active').eq('id', user.id).maybeSingle()
    isPartner = PARTNER_ROLES.has(String(profile?.role ?? '').toLowerCase())
    isActive = profile?.is_active !== false
  }

  if (user && isPartner && !isActive) {
    await supabase.auth.signOut()
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = '?error=account_disabled'
    return NextResponse.redirect(url)
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = isPartner ? '/partner' : '/dashboard'
    return NextResponse.redirect(url)
  }

  if (user && isPartner && isInternalRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/partner'
    url.search = ''
    return NextResponse.redirect(url)
  }

  if (user && !isPartner && isPartnerRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    url.search = ''
    return NextResponse.redirect(url)
  }

  if (pathname === '/') {
    const url = request.nextUrl.clone()
    url.pathname = user ? (isPartner ? '/partner' : '/dashboard') : '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
