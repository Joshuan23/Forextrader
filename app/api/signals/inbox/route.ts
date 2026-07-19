import { NextRequest, NextResponse } from 'next/server'
import { listStoredSignals } from '@/lib/store/signals'
import { errorResponse } from '@/lib/config/runtime'

export const dynamic = 'force-dynamic'

// GET /api/signals/inbox?limit=20 — full TradingView inbox (approved and
// blocked), the web TvInbox component's data source.
export async function GET(req: NextRequest) {
  try {
    const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 20) || 20, 100)
    const signals = await listStoredSignals(limit)
    return NextResponse.json({ ok: true, count: signals.length, signals })
  } catch (e) {
    const { body, status } = errorResponse(e)
    return NextResponse.json(body, { status })
  }
}
