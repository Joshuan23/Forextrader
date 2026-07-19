import { NextRequest, NextResponse } from 'next/server'
import { getEntitlement } from '@/lib/services/subscription'
import { errorResponse } from '@/lib/config/runtime'

export const dynamic = 'force-dynamic'

// GET /api/subscription/status?userId=<supabase auth uid>
// Server-side entitlement truth from the Supabase entitlements table.
// The mobile app uses this to verify what the client-side SDK claims.
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId')
  if (!userId) return NextResponse.json({ ok: false, error: 'userId is required' }, { status: 400 })
  try {
    const entitlement = await getEntitlement(userId)
    return NextResponse.json({ ok: true, entitlement })
  } catch (e) {
    const { body, status } = errorResponse(e)
    return NextResponse.json(body, { status })
  }
}
