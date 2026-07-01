import { NextRequest, NextResponse } from 'next/server'
import { parseSession } from '@/lib/session'

const PROTECTED = ['/dashboard', '/signals', '/charts', '/backtesting', '/strategies', '/positions']
const AUTH_ONLY = ['/', '/login']

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const session = parseSession(req.headers.get('cookie'))

  if (AUTH_ONLY.includes(pathname) && session) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  const isProtected = PROTECTED.some(p => pathname === p || pathname.startsWith(p + '/'))
  if (!isProtected) return NextResponse.next()

  if (!session) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/', '/login', '/dashboard/:path*', '/signals/:path*', '/charts/:path*',
            '/backtesting/:path*', '/strategies/:path*', '/positions/:path*'],
}
