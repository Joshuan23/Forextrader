import { NextResponse } from 'next/server'
import { analyticsBySession } from '@/lib/services/analytics'
import { errorResponse } from '@/lib/config/runtime'

export const dynamic = 'force-dynamic'

// GET /api/analytics/by-session — expectancy grouped by session tag,
// computed from stored journal records.
export async function GET() {
  try {
    const groups = await analyticsBySession()
    return NextResponse.json({ ok: true, groups })
  } catch (e) {
    const { body, status } = errorResponse(e)
    return NextResponse.json(body, { status })
  }
}
