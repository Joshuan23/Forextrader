import Constants from 'expo-constants'
import { isDemoMode, isRevenueCatConfigured } from '@/lib/env'
import type { BillingProvider } from './types'
import { MockBilling } from './mock'

let provider: BillingProvider | null = null

// Billing provider selection — real subscriptions by default:
//   RC keys + native build            → RevenueCat (real store purchases)
//   Expo Go or EXPO_PUBLIC_DEMO_MODE  → mock provider (development only)
//   store build without RC keys       → loud failure; entitlements resolve
//                                       to FREE (fail-closed), never fake Pro
export function getBillingProvider(): BillingProvider {
  if (provider) return provider
  const inExpoGo = Constants.appOwnership === 'expo'
  if (!inExpoGo && isRevenueCatConfigured) {
    // Lazy import keeps the native module out of Expo Go bundles entirely.
    const { RevenueCatBilling } = require('./revenuecat') as typeof import('./revenuecat')
    provider = new RevenueCatBilling()
    return provider
  }
  if (inExpoGo || isDemoMode) {
    provider = new MockBilling()
    return provider
  }
  throw new Error(
    'Billing is not configured: set EXPO_PUBLIC_REVENUECAT_IOS_KEY / EXPO_PUBLIC_REVENUECAT_ANDROID_KEY for store builds. ' +
      'Mock billing requires EXPO_PUBLIC_DEMO_MODE=true (development only).'
  )
}

export * from './types'
export * from './products'
