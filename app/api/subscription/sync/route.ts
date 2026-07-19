import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { syncFromRevenueCat } from '@/lib/services/subscription'
import { errorResponse } from '@/lib/config/runtime'

export const dynamic = 'force-dynamic'

// POST /api/subscription/sync { appUserId }
// Pulls the subscriber's CURRENT entitlement state from the RevenueCat
// REST API (server key) and rewrites the Supabase entitlements row.
// Recovery path for missed webhooks; called by the app after purchase,
// restore, and sign-in. Never trusts client-claimed entitlements.
const schema = z.object({ appUserId: z.string().min(8) })

export async function POST(req: NextRequest) {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'appUserId is required' }, { status: 422 })
  }
  try {
    const entitlement = await syncFromRevenueCat(parsed.data.appUserId)
    return NextResponse.json({ ok: true, entitlement })
  } catch (e) {
    const { body, status } = errorResponse(e)
    return NextResponse.json(body, { status })
  }
}
