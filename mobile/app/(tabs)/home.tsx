import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Btn, Card, Loading, Screen, SectionTitle, Stat } from '@/components/ui'
import { SignalCard } from '@/components/SignalCard'
import { useSignals } from '@/hooks/useSignals'
import { useEntitlement } from '@/entitlements/context'
import { freeSignalAllowance, gates } from '@/entitlements/gating'
import { track } from '@/analytics/track'

export default function Home() {
  const router = useRouter()
  const { data: signals, isLoading } = useSignals()
  const { entitlement, entitled } = useEntitlement()

  if (isLoading || !signals) {
    return (
      <Screen scroll={false}>
        <Loading />
      </Screen>
    )
  }

  const approved = signals.filter((s) => s.status === 'approved')
  const blocked = signals.filter((s) => s.status === 'blocked')
  const top = [...approved].sort((a, b) => b.confidence - a.confidence).slice(0, 2)
  const allowance = freeSignalAllowance(approved)
  const session = approved[0]?.session ?? blocked[0]?.session ?? '—'

  return (
    <Screen>
      <View className="flex-row gap-2">
        <Stat label="Session" value={session.replace(/_/g, ' ')} />
        <Stat label="Approved" value={String(approved.length)} tone="long" />
        <Stat label="Blocked" value={String(blocked.length)} />
      </View>

      {!entitled && (
        <Pressable
          onPress={() => {
            void track({ name: 'upgrade_clicked', productId: 'home_banner' })
            router.push({ pathname: '/paywall', params: { source: 'home_banner' } })
          }}
          className="mt-3 active:opacity-80"
        >
          <Card className="border-primary/40 bg-primary/10">
            <Text className="text-sm font-semibold text-primary">Unlock every live signal</Text>
            <Text className="mt-0.5 text-xs text-subtle">
              Exact entry / stop / TP levels and full reasoning — 7-day free Pro trial.
            </Text>
          </Card>
        </Pressable>
      )}

      <SectionTitle>Top approved signals</SectionTitle>
      <View className="gap-3">
        {top.length === 0 ? (
          <Card>
            <Text className="text-center text-sm font-semibold text-foreground">NO TRADE</Text>
            <Text className="mt-1 text-center text-xs text-subtle">
              No setup clears the contextual filters right now. Standing aside is a position.
            </Text>
          </Card>
        ) : (
          top.map((s) => (
            <SignalCard
              key={s.id}
              signal={s}
              unlockedForFree={!gates.exactLevels(entitlement) && allowance.has(s.id)}
            />
          ))
        )}
      </View>

      <SectionTitle>Quick access</SectionTitle>
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Btn title="Journal" variant="outline" onPress={() => router.push('/(tabs)/journal')} />
        </View>
        <View className="flex-1">
          <Btn title="Analytics" variant="outline" onPress={() => router.push('/(tabs)/analytics')} />
        </View>
      </View>
    </Screen>
  )
}
