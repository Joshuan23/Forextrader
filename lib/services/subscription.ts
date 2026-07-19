import { SetupError, isDemoMode } from '@/lib/config/runtime'
import { sbSelect, sbUpsert } from '@/lib/services/supabase-admin'

// Subscription service — server-side entitlement truth.
// Reads come from the Supabase `entitlements` table (kept current by the
// RevenueCat webhook). `syncFromRevenueCat` is the recovery path: it asks
// the RevenueCat REST API for the subscriber's CURRENT state and re-writes
// the row, so a missed webhook can never strand a paying user.

export type Plan = 'free' | 'pro' | 'elite'

export interface EntitlementRow {
  user_id: string
  plan: Plan
  status: 'none' | 'active' | 'trialing' | 'grace' | 'cancelled' | 'expired'
  product_id: string | null
  platform: string | null
  current_period_end: string | null
}

const FREE: Omit<EntitlementRow, 'user_id'> = {
  plan: 'free',
  status: 'none',
  product_id: null,
  platform: null,
  current_period_end: null,
}

export async function getEntitlement(userId: string): Promise<EntitlementRow> {
  if (isDemoMode()) return { user_id: userId, ...FREE, plan: 'pro', status: 'active' }
  const rows = await sbSelect<EntitlementRow>(
    'entitlements',
    `user_id=eq.${encodeURIComponent(userId)}&select=user_id,plan,status,product_id,platform,current_period_end&limit=1`
  )
  return rows[0] ?? { user_id: userId, ...FREE }
}

interface RcSubscriberResponse {
  subscriber: {
    entitlements: Record<
      string,
      { product_identifier: string; expires_date: string | null; period_type?: string }
    >
  }
}

export async function syncFromRevenueCat(appUserId: string): Promise<EntitlementRow> {
  const rcKey = process.env.REVENUECAT_SECRET_KEY
  if (!rcKey) {
    throw new SetupError(
      'REVENUECAT_SECRET_KEY is not configured — create a secret API key in the RevenueCat dashboard and set it on the server to enable entitlement sync.'
    )
  }

  const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`, {
    headers: { Authorization: `Bearer ${rcKey}` },
    signal: AbortSignal.timeout(8000),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`RevenueCat subscriber lookup failed: HTTP ${res.status}`)
  const data = (await res.json()) as RcSubscriberResponse

  const ents = data.subscriber.entitlements ?? {}
  const now = Date.now()
  const activeIds = Object.entries(ents)
    .filter(([, e]) => !e.expires_date || Date.parse(e.expires_date) > now)
    .map(([id]) => id)

  const plan: Plan = activeIds.includes('elite') ? 'elite' : activeIds.includes('pro') ? 'pro' : 'free'
  const best = ents[plan === 'elite' ? 'elite' : 'pro']
  const row: EntitlementRow = {
    user_id: appUserId,
    plan,
    status:
      plan === 'free'
        ? 'expired'
        : best?.period_type === 'trial' || best?.period_type === 'TRIAL'
          ? 'trialing'
          : 'active',
    product_id: plan === 'free' ? null : (best?.product_identifier ?? null),
    platform: null,
    current_period_end: plan === 'free' ? null : (best?.expires_date ?? null),
  }

  await sbUpsert('entitlements', { ...row, updated_at: new Date().toISOString() }, 'user_id')
  return row
}
