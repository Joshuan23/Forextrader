import React, { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Btn, Card, Loading, Screen } from '@/components/ui'
import { getBillingProvider, PLAN_FEATURES, type OfferedProduct } from '@/billing'
import { useEntitlement } from '@/entitlements/context'
import { track } from '@/analytics/track'

// The conversion surface. Benefit-first, restrained, restore always visible.
export default function Paywall() {
  const router = useRouter()
  const { source } = useLocalSearchParams<{ source?: string }>()
  const { entitlement, refresh } = useEntitlement()
  const [offerings, setOfferings] = useState<OfferedProduct[] | null>(null)
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('yearly')
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    void track({ name: 'paywall_viewed', source: source ?? 'unknown', plan: entitlement.plan })
    void getBillingProvider().getOfferings().then(setOfferings)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function buy(p: OfferedProduct) {
    setBusy(p.productId)
    setMessage(null)
    void track({ name: 'upgrade_clicked', productId: p.productId })
    const result = await getBillingProvider().purchase(p.productId)
    setBusy(null)
    if (result.outcome === 'purchased') {
      void track({
        name: result.entitlement.status === 'trialing' ? 'trial_started' : 'subscription_purchased',
        productId: p.productId,
      })
      await refresh()
      router.back()
    } else if (result.outcome === 'error') {
      setMessage(result.message)
    }
  }

  async function restore() {
    setMessage(null)
    const e = await getBillingProvider().restore()
    void track({ name: 'subscription_restored' })
    await refresh()
    setMessage(e.plan === 'free' ? 'No previous purchases found.' : `Restored ${e.plan.toUpperCase()}.`)
  }

  if (!offerings) {
    return (
      <Screen scroll={false}>
        <Loading />
      </Screen>
    )
  }

  const shown = offerings.filter((o) => o.period === period)
  const proTrial = offerings.find((o) => o.plan === 'pro' && o.trialEligible)

  return (
    <Screen>
      <Text className="mt-2 text-2xl font-bold leading-8 text-foreground">
        Trade the plan,{'\n'}not the noise.
      </Text>
      <Text className="mt-2 text-sm leading-6 text-subtle">
        Every FlowEdge signal is validated against session, news, volatility, and execution quality
        — with exact entry, stop, and targets. No signal fires without context.
      </Text>

      {proTrial && (
        <Card className="mt-3 border-long/40 bg-long/10">
          <Text className="text-sm font-semibold text-long">7-day free trial available on Pro</Text>
          <Text className="mt-0.5 text-xs text-subtle">Cancel any time before the trial ends — you won't be charged.</Text>
        </Card>
      )}

      {/* Period toggle */}
      <View className="mt-4 flex-row rounded-lg border border-border bg-card p-1">
        {(['yearly', 'monthly'] as const).map((p) => (
          <Pressable
            key={p}
            onPress={() => setPeriod(p)}
            className={`flex-1 items-center rounded-md py-2 ${period === p ? 'bg-primary/20' : ''}`}
          >
            <Text className={`text-sm font-semibold ${period === p ? 'text-primary' : 'text-subtle'}`}>
              {p === 'yearly' ? 'Yearly · Save 33%' : 'Monthly'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Pricing cards */}
      <View className="mt-3 gap-3">
        {shown.map((p) => (
          <Card key={p.productId} className={p.plan === 'pro' ? 'border-primary/50' : ''}>
            <View className="flex-row items-center justify-between">
              <Text className="text-base font-bold uppercase text-foreground">{p.plan}</Text>
              <View className="items-end">
                <Text className="font-mono text-base font-semibold text-foreground">{p.priceString}</Text>
                <Text className="text-[11px] text-subtle">{p.pricePerMonthString}{p.savingsBadge ? ` · ${p.savingsBadge}` : ''}</Text>
              </View>
            </View>
            <View className="mt-2 gap-1">
              {PLAN_FEATURES[p.plan].slice(0, p.plan === 'elite' ? 5 : 4).map((f) => (
                <Text key={f} className="text-xs leading-5 text-subtle">✓ {f}</Text>
              ))}
            </View>
            <View className="mt-3">
              <Btn
                title={
                  busy === p.productId
                    ? 'Processing…'
                    : p.trialEligible
                      ? `Start 7-day free trial`
                      : `Get ${p.plan === 'pro' ? 'Pro' : 'Elite'}`
                }
                onPress={() => void buy(p)}
                disabled={busy !== null}
                variant={p.plan === 'pro' ? 'primary' : 'outline'}
              />
            </View>
          </Card>
        ))}
      </View>

      {/* Comparison table */}
      <Card className="mt-4">
        <Text className="mb-2 text-xs font-semibold uppercase tracking-widest text-subtle">Compare</Text>
        {[
          ['Signals per day', '1 full', 'All', 'All'],
          ['Exact levels', '—', '✓', '✓'],
          ['Reasoning', '—', 'Full', 'Full + derivations'],
          ['Journal', '10 rows', 'Unlimited', 'Unlimited'],
          ['Analytics', '7-day teaser', 'Standard', 'Advanced + edge'],
          ['Alerts', '—', 'Signals', 'Custom'],
        ].map(([feature, free, pro, elite]) => (
          <View key={feature} className="flex-row border-t border-border py-1.5 first:border-t-0">
            <Text className="flex-1 text-xs text-subtle">{feature}</Text>
            <Text className="w-16 text-center text-xs text-subtle">{free}</Text>
            <Text className="w-16 text-center text-xs font-medium text-foreground">{pro}</Text>
            <Text className="w-24 text-center text-xs font-medium text-primary">{elite}</Text>
          </View>
        ))}
        <View className="flex-row pt-1">
          <Text className="flex-1" />
          <Text className="w-16 text-center text-[10px] uppercase text-subtle">Free</Text>
          <Text className="w-16 text-center text-[10px] uppercase text-subtle">Pro</Text>
          <Text className="w-24 text-center text-[10px] uppercase text-subtle">Elite</Text>
        </View>
      </Card>

      {message && <Text className="mt-3 text-center text-xs text-warn">{message}</Text>}

      <View className="mt-4 gap-2">
        <Btn title="Restore purchases" variant="outline" onPress={() => void restore()} />
        <Btn title="Not now" variant="ghost" onPress={() => router.back()} />
      </View>
      <Text className="mt-2 pb-4 text-center text-[10px] leading-4 text-subtle">
        Subscriptions renew automatically until cancelled in your App Store / Google Play account
        settings. Prices shown are from the store at purchase time.
      </Text>
    </Screen>
  )
}
