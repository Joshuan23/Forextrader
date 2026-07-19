import { NextResponse } from 'next/server'
import { analyticsOverview } from '@/lib/services/analytics'
import { errorResponse } from '@/lib/config/runtime'

export const dynamic = 'force-dynamic'

// GET /api/analytics/overview — expectancy, profit factor, win rate,
// avg win/loss, drawdown, stay-out quality, equity curve, grade
// performance, win rate by pair, blocked-reason frequency.
// Computed live from stored journal entries and persisted signals.
export async function GET() {
  try {
    return NextResponse.json({ ok: true, ...(await analyticsOverview()) })
  } catch (e) {
    const { body, status } = errorResponse(e)
    return NextResponse.json(body, { status })
  }
}
