import { NextRequest, NextResponse } from 'next/server'
import type { SessionPayload } from '@/types/subscription'

const PROTECTED = ['/dashboard', '/signals', '/charts', '/backtesting', '/strategies', '/positions', '/challenge']
const AUTH_ONLY = ['/', '/login']

// base64url → Uint8Array without relying on Node.js Buffer (Edge Runtime safe)
function b64urlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const base64 = s.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=')
  const binary = atob(padded)
  const buf = new ArrayBuffer(binary.length)
  const bytes = new Uint8Array(buf)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function parseSession(cookieHeader: string | null): Promise<SessionPayload | null> {
  if (!cookieHeader) return null
  const match = cookieHeader.match(/fxt_session=([^;]+)/)
  if (!match) return null
  const [data, sig] = match[1].split('.')
  if (!data || !sig) return null

  const secret = process.env.SESSION_SECRET
  if (!secret) return null

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  )

  const valid = await crypto.subtle.verify('HMAC', key, b64urlToBytes(sig), new TextEncoder().encode(data))
  if (!valid) return null

  try {
    const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(data))) as SessionPayload
    if (payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const session = await parseSession(req.headers.get('cookie'))

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
            '/backtesting/:path*', '/strategies/:path*', '/positions/:path*', '/challenge/:path*'],
}
