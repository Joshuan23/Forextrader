import type { Plan } from '@/entitlements/types'

// Store product identifiers — must match App Store Connect / Play Console
// and the RevenueCat offering configuration exactly.
export const PRODUCT_IDS = {
  proMonthly: 'flowedge_pro_monthly',
  proYearly: 'flowedge_pro_yearly',
  eliteMonthly: 'flowedge_elite_monthly',
  eliteYearly: 'flowedge_elite_yearly',
} as const

export type ProductId = (typeof PRODUCT_IDS)[keyof typeof PRODUCT_IDS]

// RevenueCat entitlement identifiers → app plan. Configure two
// entitlements in RevenueCat ("pro", "elite"); elite products grant both.
export const RC_ENTITLEMENT_TO_PLAN: Record<string, Plan> = {
  elite: 'elite',
  pro: 'pro',
}

export interface DisplayProduct {
  productId: ProductId
  plan: Exclude<Plan, 'free'>
  period: 'monthly' | 'yearly'
  // Fallback display pricing for mock mode; live prices come from the store.
  priceString: string
  pricePerMonthString: string
  savingsBadge?: string
  trialDays?: number
}

export const DISPLAY_PRODUCTS: DisplayProduct[] = [
  {
    productId: PRODUCT_IDS.proMonthly,
    plan: 'pro',
    period: 'monthly',
    priceString: '$29.99/mo',
    pricePerMonthString: '$29.99/mo',
    trialDays: 7,
  },
  {
    productId: PRODUCT_IDS.proYearly,
    plan: 'pro',
    period: 'yearly',
    priceString: '$239.99/yr',
    pricePerMonthString: '$20.00/mo',
    savingsBadge: 'Save 33%',
    trialDays: 7,
  },
  {
    productId: PRODUCT_IDS.eliteMonthly,
    plan: 'elite',
    period: 'monthly',
    priceString: '$59.99/mo',
    pricePerMonthString: '$59.99/mo',
  },
  {
    productId: PRODUCT_IDS.eliteYearly,
    plan: 'elite',
    period: 'yearly',
    priceString: '$479.99/yr',
    pricePerMonthString: '$40.00/mo',
    savingsBadge: 'Save 33%',
  },
]

export const PLAN_FEATURES: Record<Plan, string[]> = {
  free: [
    '1 full signal per day',
    'Delayed signals with locked levels',
    '10 journal entries',
    '7-day analytics window',
  ],
  pro: [
    'All live signals, exact entry / SL / TP1 / TP2',
    'Full plain-English signal reasoning',
    'Unlimited journal + mistake tags',
    'Standard analytics (win rate, expectancy, equity curve)',
    'Session filters',
    'Push alerts for approved signals',
  ],
  elite: [
    'Everything in Pro',
    'Layer-by-layer score derivations',
    'Historical edge reports by setup × session',
    'Execution quality & spread-drag analysis',
    'Top setups by session',
    'Strategy profiles + premium signal filters',
    'Custom alerts',
    'Concierge onboarding',
  ],
}
