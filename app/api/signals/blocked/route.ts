import { NextResponse } from 'next/server'
import { listStoredSignals } from '@/lib/store/signals'
import { errorResponse } from '@/lib/config/runtime'

export const dynamic = 'force-dynamic'

// GET /api/signals/blocked — persisted blocked signals with their reasons.
// Blocked cards are product surface: they show the discipline layer working.
export async function GET() {
  try {
    const all = await listStoredSignals(200)
    const blocked = all.filter((s) => s.status === 'blocked')
    return NextResponse.json({ ok: true, count: blocked.length, signals: blocked })
  } catch (e) {
    const { body, status } = errorResponse(e)
    return NextResponse.json(body, { status })
  }
}
