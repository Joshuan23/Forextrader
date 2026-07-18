import type { Entitlement } from '@/entitlements/types'
import type { DisplayProduct, ProductId } from './products'

export interface OfferedProduct extends DisplayProduct {
  // Live store pricing when available (RevenueCat), fallback otherwise.
  live: boolean
  trialEligible: boolean
}

export type PurchaseResult =
  | { outcome: 'purchased'; entitlement: Entitlement }
  | { outcome: 'cancelled' }
  | { outcome: 'error'; message: string }

// Billing abstraction: RevenueCat on device builds, mock in Expo Go/dev.
// A future Stripe web checkout implements this same interface server-side —
// entitlements always converge in the `entitlements` table, so the app
// never cares where a subscription was bought.
export interface BillingProvider {
  readonly name: 'revenuecat' | 'mock'
  init(appUserId: string | null): Promise<void>
  getOfferings(): Promise<OfferedProduct[]>
  purchase(productId: ProductId): Promise<PurchaseResult>
  restore(): Promise<Entitlement>
  getEntitlement(): Promise<Entitlement>
  manageSubscriptionUrl(): Promise<string | null>
}
