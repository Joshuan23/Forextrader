import { NextResponse } from 'next/server'
import { listStoredSignals } from '@/lib/store/signals'
import { errorResponse } from '@/lib/config/runtime'

export const dynamic = 'force-dynamic'

// GET /api/signals/active — persisted approved signals (webhook-ingested),
// newest first, expired ones filtered out.
export async function GET() {
  try {
    const all = await listStoredSignals(200)
    const now = Date.now()
    const active = all.filter(
      (s) => s.status === 'approved' && s.lifecycle !== 'cancelled' && s.expiresAt > now
    )
    return NextResponse.json({ ok: true, count: active.length, signals: active })
  } catch (e) {
    const { body, status } = errorResponse(e)
    return NextResponse.json(body, { status })
  }
}
