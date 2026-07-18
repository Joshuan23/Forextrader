import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// RevenueCat → Supabase entitlement sync.
// Configure in RevenueCat: Project → Integrations → Webhooks, URL
// https://<app>/api/webhooks/revenuecat, Authorization header set to
// REVENUECAT_WEBHOOK_AUTH. Writes use the Supabase service role via
// PostgREST — the mobile app only ever reads entitlements.

const eventSchema = z.object({
  event: z.object({
    type: z.enum([
      'INITIAL_PURCHASE',
      'RENEWAL',
      'PRODUCT_CHANGE',
      'CANCELLATION',
      'UNCANCELLATION',
      'BILLING_ISSUE',
      'EXPIRATION',
      'SUBSCRIPTION_PAUSED',
      'TRANSFER',
      'TEST',
    ]),
    app_user_id: z.string(),
    product_id: z.string().optional(),
    entitlement_ids: z.array(z.string()).nullish(),
    period_type: z.string().optional(), // NORMAL | TRIAL | INTRO
    expiration_at_ms: z.number().nullish(),
    store: z.string().optional(), // APP_STORE | PLAY_STORE | ...
  }),
})

type RcEvent = z.infer<typeof eventSchema>['event']

function planFromEntitlements(ids: string[] | null | undefined): 'free' | 'pro' | 'elite' {
  if (ids?.includes('elite')) return 'elite'
  if (ids?.includes('pro')) return 'pro'
  return 'free'
}

function statusFromEvent(e: RcEvent): string {
  switch (e.type) {
    case 'INITIAL_PURCHASE':
    case 'RENEWAL':
    case 'UNCANCELLATION':
    case 'PRODUCT_CHANGE':
      return e.period_type === 'TRIAL' ? 'trialing' : 'active'
    case 'CANCELLATION':
      return 'cancelled' // entitled until expiration_at
    case 'BILLING_ISSUE':
      return 'grace'
    case 'EXPIRATION':
    case 'SUBSCRIPTION_PAUSED':
      return 'expired'
    default:
      return 'active'
  }
}

function platformFromStore(store?: string): 'ios' | 'android' | 'web' {
  if (store === 'APP_STORE' || store === 'MAC_APP_STORE') return 'ios'
  if (store === 'PLAY_STORE') return 'android'
  return 'web'
}

async function upsertEntitlement(e: RcEvent): Promise<void> {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service credentials not configured')

  const expired = e.type === 'EXPIRATION' || e.type === 'SUBSCRIPTION_PAUSED'
  const row = {
    // RC app_user_id is set to the Supabase auth uid by the mobile app
    user_id: e.app_user_id,
    plan: expired ? 'free' : planFromEntitlements(e.entitlement_ids),
    status: statusFromEvent(e),
    product_id: e.product_id ?? null,
    platform: platformFromStore(e.store),
    current_period_end: e.expiration_at_ms ? new Date(e.expiration_at_ms).toISOString() : null,
    updated_at: new Date().toISOString(),
  }

  const res = await fetch(`${url}/rest/v1/entitlements`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(row),
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`Supabase upsert failed: HTTP ${res.status} ${await res.text()}`)
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? ''
  const expected = process.env.REVENUECAT_WEBHOOK_AUTH
  if (!expected) {
    return NextResponse.json({ ok: false, error: 'REVENUECAT_WEBHOOK_AUTH not configured' }, { status: 503 })
  }
  if (auth !== expected) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }
  const parsed = eventSchema.safeParse(raw)
  if (!parsed.success) {
    // Unknown event shapes are acknowledged so RC doesn't retry forever.
    return NextResponse.json({ ok: true, skipped: true })
  }

  const e = parsed.data.event
  if (e.type === 'TEST') return NextResponse.json({ ok: true, test: true })

  try {
    await upsertEntitlement(e)
    return NextResponse.json({ ok: true, type: e.type, plan: planFromEntitlements(e.entitlement_ids) })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'sync_failed' },
      { status: 500 }
    )
  }
}
