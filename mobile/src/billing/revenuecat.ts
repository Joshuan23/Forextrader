import { Platform } from 'react-native'
import { env } from '@/lib/env'
import { FREE_ENTITLEMENT, type Entitlement, type Plan } from '@/entitlements/types'
import { DISPLAY_PRODUCTS, RC_ENTITLEMENT_TO_PLAN, type ProductId } from './products'
import type { BillingProvider, OfferedProduct, PurchaseResult } from './types'

// RevenueCat adapter. `react-native-purchases` is a native module — it is
// loaded lazily so the app still runs in Expo Go (where the mock provider
// is selected instead).

// Minimal structural types for the parts of the RC SDK we touch.
interface RcEntitlementInfo {
  identifier: string
  productIdentifier: string
  expirationDate: string | null
  willRenew: boolean
  periodType: string // NORMAL | TRIAL | INTRO
  billingIssueDetectedAt: string | null
  unsubscribeDetectedAt: string | null
  store: string
}
interface RcCustomerInfo {
  entitlements: { active: Record<string, RcEntitlementInfo> }
  managementURL: string | null
}
interface RcPackage {
  identifier: string
  product: { identifier: string; priceString: string }
}
interface RcSdk {
  configure(opts: { apiKey: string; appUserID?: string | null }): void
  getOfferings(): Promise<{ current: { availablePackages: RcPackage[] } | null }>
  purchasePackage(pkg: RcPackage): Promise<{ customerInfo: RcCustomerInfo }>
  restorePurchases(): Promise<RcCustomerInfo>
  getCustomerInfo(): Promise<RcCustomerInfo>
  logIn(appUserID: string): Promise<{ customerInfo: RcCustomerInfo }>
}

function loadSdk(): RcSdk {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('react-native-purchases') as { default: RcSdk }
  return mod.default
}

// Map RC customer info → the app's entitlement model. Highest tier wins.
export function entitlementFromCustomerInfo(info: RcCustomerInfo): Entitlement {
  const active = Object.values(info.entitlements.active)
  if (active.length === 0) return { plan: 'free', status: 'expired' }

  let best: { plan: Plan; e: RcEntitlementInfo } | null = null
  for (const e of active) {
    const plan = RC_ENTITLEMENT_TO_PLAN[e.identifier]
    if (!plan) continue
    if (!best || (plan === 'elite' && best.plan !== 'elite')) best = { plan, e }
  }
  if (!best) return FREE_ENTITLEMENT

  const e = best.e
  const status = e.billingIssueDetectedAt
    ? 'grace'
    : e.periodType === 'TRIAL'
      ? 'trialing'
      : e.unsubscribeDetectedAt
        ? 'cancelled'
        : 'active'

  return {
    plan: best.plan,
    status,
    productId: e.productIdentifier,
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    currentPeriodEnd: e.expirationDate ? Date.parse(e.expirationDate) : undefined,
    willRenew: e.willRenew,
  }
}

export class RevenueCatBilling implements BillingProvider {
  readonly name = 'revenuecat' as const
  private sdk: RcSdk | null = null
  private packages: RcPackage[] = []

  async init(appUserId: string | null): Promise<void> {
    const apiKey = Platform.OS === 'ios' ? env.revenueCatIosKey : env.revenueCatAndroidKey
    if (!apiKey) throw new Error('RevenueCat key missing for this platform')
    this.sdk = loadSdk()
    this.sdk.configure({ apiKey, appUserID: appUserId })
    if (appUserId) await this.sdk.logIn(appUserId).catch(() => undefined)
  }

  async getOfferings(): Promise<OfferedProduct[]> {
    const offerings = await this.sdk!.getOfferings()
    this.packages = offerings.current?.availablePackages ?? []
    return DISPLAY_PRODUCTS.map((dp) => {
      const pkg = this.packages.find((p) => p.product.identifier === dp.productId)
      return {
        ...dp,
        priceString: pkg ? perPeriod(pkg.product.priceString, dp.period) : dp.priceString,
        live: Boolean(pkg),
        trialEligible: Boolean(dp.trialDays), // store decides finally at purchase
      }
    })
  }

  async purchase(productId: ProductId): Promise<PurchaseResult> {
    const pkg = this.packages.find((p) => p.product.identifier === productId)
    if (!pkg) return { outcome: 'error', message: `Product ${productId} not in current offering` }
    try {
      const { customerInfo } = await this.sdk!.purchasePackage(pkg)
      return { outcome: 'purchased', entitlement: entitlementFromCustomerInfo(customerInfo) }
    } catch (e) {
      const err = e as { userCancelled?: boolean; message?: string }
      if (err.userCancelled) return { outcome: 'cancelled' }
      return { outcome: 'error', message: err.message ?? 'Purchase failed' }
    }
  }

  async restore(): Promise<Entitlement> {
    return entitlementFromCustomerInfo(await this.sdk!.restorePurchases())
  }

  async getEntitlement(): Promise<Entitlement> {
    return entitlementFromCustomerInfo(await this.sdk!.getCustomerInfo())
  }

  async manageSubscriptionUrl(): Promise<string | null> {
    const info = await this.sdk!.getCustomerInfo()
    return info.managementURL
  }
}

function perPeriod(priceString: string, period: 'monthly' | 'yearly'): string {
  return `${priceString}/${period === 'monthly' ? 'mo' : 'yr'}`
}
