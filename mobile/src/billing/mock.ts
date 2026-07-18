import AsyncStorage from '@react-native-async-storage/async-storage'
import { FREE_ENTITLEMENT, type Entitlement } from '@/entitlements/types'
import { DISPLAY_PRODUCTS, type ProductId } from './products'
import type { BillingProvider, OfferedProduct, PurchaseResult } from './types'

const KEY = 'flowedge.mock.entitlement'
const MONTH = 30 * 24 * 60 * 60 * 1000

// Dev/Expo Go billing: simulates purchase, trial, restore, and persistence
// so every entitlement state can be exercised without stores.
export class MockBilling implements BillingProvider {
  readonly name = 'mock' as const

  async init(): Promise<void> {}

  async getOfferings(): Promise<OfferedProduct[]> {
    const current = await this.getEntitlement()
    return DISPLAY_PRODUCTS.map((dp) => ({
      ...dp,
      live: false,
      trialEligible: Boolean(dp.trialDays) && current.status === 'none',
    }))
  }

  async purchase(productId: ProductId): Promise<PurchaseResult> {
    const product = DISPLAY_PRODUCTS.find((p) => p.productId === productId)
    if (!product) return { outcome: 'error', message: 'Unknown product' }
    const prior = await this.getEntitlement()
    const startTrial = Boolean(product.trialDays) && prior.status === 'none'
    const periodMs = product.period === 'monthly' ? MONTH : 12 * MONTH
    const entitlement: Entitlement = {
      plan: product.plan,
      status: startTrial ? 'trialing' : 'active',
      productId,
      platform: 'ios',
      currentPeriodEnd: Date.now() + (startTrial ? product.trialDays! * 24 * 60 * 60 * 1000 : periodMs),
      trialEndsAt: startTrial ? Date.now() + product.trialDays! * 24 * 60 * 60 * 1000 : undefined,
      willRenew: true,
    }
    await AsyncStorage.setItem(KEY, JSON.stringify(entitlement))
    return { outcome: 'purchased', entitlement }
  }

  async restore(): Promise<Entitlement> {
    return this.getEntitlement()
  }

  async getEntitlement(): Promise<Entitlement> {
    const raw = await AsyncStorage.getItem(KEY)
    if (!raw) return FREE_ENTITLEMENT
    try {
      return JSON.parse(raw) as Entitlement
    } catch {
      return FREE_ENTITLEMENT
    }
  }

  async manageSubscriptionUrl(): Promise<string | null> {
    return null
  }
}
