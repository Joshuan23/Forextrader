import { NextResponse } from 'next/server'
import { analyticsBySetup } from '@/lib/services/analytics'
import { errorResponse } from '@/lib/config/runtime'

export const dynamic = 'force-dynamic'

// GET /api/analytics/by-setup — expectancy grouped by setup type,
// computed from stored journal records.
export async function GET() {
  try {
    const groups = await analyticsBySetup()
    return NextResponse.json({ ok: true, groups })
  } catch (e) {
    const { body, status } = errorResponse(e)
    return NextResponse.json(body, { status })
  }
}
