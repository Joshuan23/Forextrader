export type Plan = 'free' | 'pro' | 'elite'

export type SubscriptionStatus =
  | 'none' // never subscribed
  | 'active'
  | 'trialing'
  | 'grace' // billing issue, still entitled
  | 'cancelled' // cancelled, entitled until period end
  | 'expired'

export type Platform = 'ios' | 'android' | 'web'

export interface Entitlement {
  plan: Plan
  status: SubscriptionStatus
  productId?: string
  platform?: Platform
  currentPeriodEnd?: number // unix ms
  trialEndsAt?: number
  willRenew?: boolean
}

export const FREE_ENTITLEMENT: Entitlement = { plan: 'free', status: 'none' }

// A user is entitled to paid features while active/trialing/grace, and
// after cancelling until the paid period actually ends.
export function isEntitled(e: Entitlement): boolean {
  if (e.plan === 'free') return false
  if (e.status === 'active' || e.status === 'trialing' || e.status === 'grace') return true
  if (e.status === 'cancelled') return (e.currentPeriodEnd ?? 0) > Date.now()
  return false
}

const TIER_ORDER: Record<Plan, number> = { free: 0, pro: 1, elite: 2 }

export function tierAtLeast(e: Entitlement, plan: Plan): boolean {
  const effective: Plan = isEntitled(e) ? e.plan : 'free'
  return TIER_ORDER[effective] >= TIER_ORDER[plan]
}
