import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { registerPushToken } from '@/lib/services/notifications'
import { errorResponse } from '@/lib/config/runtime'

export const dynamic = 'force-dynamic'

// POST /api/notifications/register { userId, expoPushToken, signalAlerts? }
// Stores the device's Expo push token so approved A/B signals can be
// fanned out to entitled users.
const schema = z.object({
  userId: z.string().min(8),
  expoPushToken: z.string().regex(/^Expo(nent)?PushToken\[.+\]$/, 'must be an Expo push token'),
  signalAlerts: z.boolean().optional(),
})

export async function POST(req: NextRequest) {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    const error = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    return NextResponse.json({ ok: false, error }, { status: 422 })
  }
  try {
    await registerPushToken(parsed.data)
    return NextResponse.json({ ok: true })
  } catch (e) {
    const { body, status } = errorResponse(e)
    return NextResponse.json(body, { status })
  }
}
