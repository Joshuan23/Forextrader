import React, { useEffect, useState } from 'react'
import { Switch, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Btn, Card, Screen, SectionTitle, Badge } from '@/components/ui'
import { useEntitlement } from '@/entitlements/context'
import { getSupabase } from '@/lib/supabase'
import { loadPrefs, savePrefs, type UserPrefs, DEFAULT_PREFS } from '@/lib/prefs'
import { registerForPush } from '@/notifications/push'

export default function Profile() {
  const router = useRouter()
  const { entitlement, entitled, refresh } = useEntitlement()
  const [prefs, setPrefs] = useState<UserPrefs>(DEFAULT_PREFS)
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    void loadPrefs().then(setPrefs)
    const supabase = getSupabase()
    if (supabase) void supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null))
  }, [])

  const planLabel = entitled ? entitlement.plan.toUpperCase() : 'FREE'

  return (
    <Screen>
      <Card className="gap-1.5">
        <View className="flex-row items-center justify-between">
          <Text className="text-sm font-semibold text-foreground">{email ?? 'Guest'}</Text>
          <Badge tone={entitled ? 'primary' : 'muted'}>{planLabel}</Badge>
        </View>
        <Text className="text-xs text-subtle">
          {entitlement.status === 'trialing'
            ? `Trial — ends ${fmtDate(entitlement.trialEndsAt)}`
            : entitlement.status === 'grace'
              ? 'Billing issue — access continues during the grace period. Update your payment method.'
              : entitlement.status === 'cancelled'
                ? `Cancelled — access until ${fmtDate(entitlement.currentPeriodEnd)}`
                : entitled
                  ? `Renews ${fmtDate(entitlement.currentPeriodEnd)}`
                  : 'Free plan — 1 full signal per day'}
        </Text>
        {!email && (
          <View className="mt-1">
            <Btn title="Sign in" variant="outline" onPress={() => router.push('/sign-in')} />
          </View>
        )}
      </Card>

      <SectionTitle>Subscription</SectionTitle>
      <View className="gap-2">
        <Btn title={entitled ? 'Manage subscription' : 'See plans'} onPress={() => router.push(entitled ? '/billing' : '/paywall')} />
        {!entitled && <Btn title="Billing details" variant="outline" onPress={() => router.push('/billing')} />}
      </View>

      <SectionTitle>Notifications</SectionTitle>
      <Card className="gap-3">
        <Row
          label="Signal alerts"
          sub={entitled ? 'Push on every approved signal' : 'Pro feature'}
          value={prefs.notificationsEnabled}
          onChange={(v) => {
            if (v) void registerForPush(entitlement.plan)
            void savePrefs({ notificationsEnabled: v }).then(setPrefs)
          }}
        />
      </Card>

      <SectionTitle>Preferences</SectionTitle>
      <Card className="gap-1">
        <Text className="text-xs text-subtle">Focus: {prefs.tradingFocus}</Text>
        <Text className="text-xs text-subtle">Pairs: {prefs.pairs.join(', ')}</Text>
        <Text className="text-xs text-subtle">Sessions: {prefs.sessions.map((s) => s.replace(/_/g, ' ')).join(', ')}</Text>
        <View className="mt-2">
          <Btn
            title="Re-run onboarding"
            variant="outline"
            onPress={() => {
              void savePrefs({ onboarded: false }).then(() => router.replace('/onboarding'))
            }}
          />
        </View>
      </Card>

      <SectionTitle>Account</SectionTitle>
      <Btn
        title="Sign out"
        variant="ghost"
        onPress={() => {
          const supabase = getSupabase()
          if (supabase) void supabase.auth.signOut().then(() => refresh())
          setEmail(null)
        }}
      />
    </Screen>
  )
}

function Row({ label, sub, value, onChange }: { label: string; sub: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View className="flex-row items-center justify-between">
      <View className="flex-1 pr-3">
        <Text className="text-sm font-medium text-foreground">{label}</Text>
        <Text className="text-xs text-subtle">{sub}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: '#52a8ff', false: '#151b29' }} />
    </View>
  )
}

function fmtDate(ms?: number): string {
  return ms ? new Date(ms).toLocaleDateString() : '—'
}
