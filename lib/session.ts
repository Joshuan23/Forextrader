import { createHmac, timingSafeEqual } from 'crypto'
import { SessionPayload } from '@/types/subscription'

const SECRET = process.env.SESSION_SECRET!
const COOKIE_NAME = 'fxt_session'
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

function sign(data: string): string {
  return createHmac('sha256', SECRET).update(data).digest('base64url')
}

export function createSessionCookie(payload: Omit<SessionPayload, 'exp'>): string {
  const exp = Date.now() + SESSION_TTL_MS
  const full: SessionPayload = { ...payload, exp }
  const data = Buffer.from(JSON.stringify(full)).toString('base64url')
  const sig = sign(data)
  return `${COOKIE_NAME}=${data}.${sig}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_TTL_MS / 1000}`
}

export function parseSession(cookieHeader: string | null): SessionPayload | null {
  if (!cookieHeader) return null

  const match = cookieHeader.match(/fxt_session=([^;]+)/)
  if (!match) return null

  const [data, sig] = match[1].split('.')
  if (!data || !sig) return null

  const sigBuf = Buffer.from(sig, 'base64url')
  const expectedSigBuf = Buffer.from(sign(data), 'base64url')
  if (sigBuf.length !== expectedSigBuf.length || !timingSafeEqual(sigBuf, expectedSigBuf)) return null

  try {
    const payload: SessionPayload = JSON.parse(Buffer.from(data, 'base64url').toString())
    if (payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

