import { getSupabase } from '@/lib/supabase'
import type { Plan } from '@/entitlements/types'

// Internal product analytics. Fire-and-forget: events never block UX and
// silently no-op without Supabase (dev mode logs to console).

export type AnalyticsEvent =
  | { name: 'onboarding_step'; step: string }
  | { name: 'onboarding_completed' }
  | { name: 'signal_detail_open'; signalId: string; plan: Plan }
  | { name: 'locked_feature_tapped'; feature: string; plan: Plan }
  | { name: 'paywall_viewed'; source: string; plan: Plan }
  | { name: 'upgrade_clicked'; productId: string }
  | { name: 'trial_started'; productId: string }
  | { name: 'subscription_purchased'; productId: string }
  | { name: 'subscription_restored' }
  | { name: 'subscription_cancel_intent' }
  | { name: 'churn_risk'; reason: string }
  | { name: 'feature_used'; feature: string; plan: Plan }

export async function track(event: AnalyticsEvent): Promise<void> {
  const { name, ...props } = event
  const supabase = getSupabase()
  if (!supabase) {
    if (__DEV__) console.log('[analytics]', name, props)
    return
  }
  const { data } = await supabase.auth.getUser()
  const table = name === 'paywall_viewed' ? 'paywall_impressions' : 'upgrade_events'
  await supabase
    .from(table)
    .insert({ user_id: data.user?.id ?? null, event: name, props })
    .then(() => undefined)
}
