import React, { useState } from 'react'
import { Linking, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Badge, Btn, Card, Screen, SectionTitle } from '@/components/ui'
import { getBillingProvider } from '@/billing'
import { useEntitlement } from '@/entitlements/context'
import { track } from '@/analytics/track'

export default function Billing() {
  const router = useRouter()
  const { entitlement, entitled, refresh } = useEntitlement()
  const [message, setMessage] = useState<string | null>(null)

  async function manage() {
    void track({ name: 'subscription_cancel_intent' })
    const url = await getBillingProvider().manageSubscriptionUrl()
    if (url) await Linking.openURL(url)
    else setMessage('Manage your subscription from your App Store / Google Play account settings. (Mock mode: no store link.)')
  }

  async function restore() {
    const e = await getBillingProvider().restore()
    void track({ name: 'subscription_restored' })
    await refresh()
    setMessage(e.plan === 'free' ? 'No previous purchases found.' : `Restored ${e.plan.toUpperCase()}.`)
  }

  return (
    <Screen>
      <SectionTitle>Current plan</SectionTitle>
      <Card className="gap-2">
        <View className="flex-row items-center justify-between">
          <Text className="text-base font-bold uppercase text-foreground">
            {entitled ? entitlement.plan : 'free'}
          </Text>
          <Badge
            tone={
              entitlement.status === 'grace'
                ? 'warn'
                : entitlement.status === 'trialing'
                  ? 'primary'
                  : entitled
                    ? 'long'
                    : 'muted'
            }
          >
            {entitlement.status}
          </Badge>
        </View>
        {entitlement.productId && <Text className="text-xs text-subtle">Product: {entitlement.productId}</Text>}
        {entitlement.currentPeriodEnd && (
          <Text className="text-xs text-subtle">
            {entitlement.status === 'cancelled' ? 'Access until' : entitlement.willRenew ? 'Renews' : 'Ends'}:{' '}
            {new Date(entitlement.currentPeriodEnd).toLocaleString()}
          </Text>
        )}
        {entitlement.status === 'grace' && (
          <Text className="text-xs text-warn">
            There is a billing issue with your payment method. Access continues for now — update
            your payment details in the store to keep your plan.
          </Text>
        )}
        {entitlement.status === 'expired' && (
          <Text className="text-xs text-subtle">Your subscription expired. Resubscribe to regain full access.</Text>
        )}
      </Card>

      <SectionTitle>Actions</SectionTitle>
      <View className="gap-2">
        {entitled ? (
          <>
            <Btn title="Manage subscription" onPress={() => void manage()} />
            {entitlement.plan === 'pro' && (
              <Btn title="Upgrade to Elite" variant="outline" onPress={() => router.push({ pathname: '/paywall', params: { source: 'billing_upgrade' } })} />
            )}
          </>
        ) : (
          <Btn title="See plans" onPress={() => router.push({ pathname: '/paywall', params: { source: 'billing' } })} />
        )}
        <Btn title="Restore purchases" variant="outline" onPress={() => void restore()} />
      </View>
      {message && <Text className="mt-3 text-xs text-subtle">{message}</Text>}

      <SectionTitle>FAQ</SectionTitle>
      <Card className="gap-3">
        {[
          ['How do trials work?', 'Pro includes a 7-day free trial for new subscribers. Cancel before it ends and you pay nothing.'],
          ['Where do I cancel?', 'Subscriptions are managed by Apple/Google: App Store or Play Store → Subscriptions. Cancelling keeps access until the period ends.'],
          ['Can I switch plans?', 'Upgrading Pro → Elite applies immediately with store proration. Downgrades apply at the next renewal.'],
          ['What happens on a failed payment?', 'You enter a short grace period with full access while the store retries. Fix the payment method to avoid losing access.'],
        ].map(([q, a]) => (
          <View key={q}>
            <Text className="text-sm font-semibold text-foreground">{q}</Text>
            <Text className="mt-0.5 text-xs leading-5 text-subtle">{a}</Text>
          </View>
        ))}
      </Card>
    </Screen>
  )
}
