import Constants from 'expo-constants'
import { isRevenueCatConfigured } from '@/lib/env'
import type { BillingProvider } from './types'
import { MockBilling } from './mock'

let provider: BillingProvider | null = null

// Expo Go cannot load the react-native-purchases native module; dev builds
// and store builds with RC keys use the real adapter.
export function getBillingProvider(): BillingProvider {
  if (provider) return provider
  const inExpoGo = Constants.appOwnership === 'expo'
  if (!inExpoGo && isRevenueCatConfigured) {
    // Lazy import keeps the native module out of Expo Go bundles entirely.
    const { RevenueCatBilling } = require('./revenuecat') as typeof import('./revenuecat')
    provider = new RevenueCatBilling()
  } else {
    provider = new MockBilling()
  }
  return provider
}

export * from './types'
export * from './products'
