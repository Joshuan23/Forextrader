import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Badge, Card } from './ui'
import { useEntitlement } from '@/entitlements/context'
import { gates } from '@/entitlements/gating'
import { track } from '@/analytics/track'
import type { MobileSignal } from '@/api/types'

function Level({ label, value, digitsHint, tone, locked }: {
  label: string
  value: number
  digitsHint: number
  tone?: 'long' | 'short'
  locked: boolean
}) {
  return (
    <View className="min-w-[30%] flex-1">
      <Text className="text-[10px] uppercase tracking-widest text-subtle">{label}</Text>
      <Text
        className={`font-mono text-sm font-semibold ${
          locked ? 'text-subtle' : tone === 'long' ? 'text-long' : tone === 'short' ? 'text-short' : 'text-foreground'
        }`}
      >
        {locked ? '•.•••••' : value.toFixed(digitsHint)}
      </Text>
    </View>
  )
}

function digitsFor(pair: string): number {
  if (pair.includes('JPY')) return 3
  if (pair.startsWith('XAU')) return 2
  return 4
}

// Compact signal card. Free users see the card, grade, and confidence, but
// exact levels are masked unless this signal is in today's free allowance.
export function SignalCard({ signal, unlockedForFree }: { signal: MobileSignal; unlockedForFree?: boolean }) {
  const router = useRouter()
  const { entitlement } = useEntitlement()
  const canSee = gates.exactLevels(entitlement) || Boolean(unlockedForFree)
  const blocked = signal.status === 'blocked'
  const d = digitsFor(signal.pair)
  const ageMin = Math.max(0, Math.round((Date.now() - signal.createdAt) / 60000))

  return (
    <Pressable
      onPress={() => {
        if (!canSee && !blocked) {
          void track({ name: 'locked_feature_tapped', feature: 'signal_levels', plan: entitlement.plan })
          router.push({ pathname: '/paywall', params: { source: 'signal_card' } })
          return
        }
        void track({ name: 'signal_detail_open', signalId: signal.id, plan: entitlement.plan })
        router.push({ pathname: '/signal/[id]', params: { id: signal.id } })
      }}
      className="active:opacity-80"
    >
      <Card className={blocked ? 'opacity-75' : ''}>
        <View className="flex-row flex-wrap items-center gap-2">
          <Text className="text-base font-semibold text-foreground">{signal.pair}</Text>
          <Badge tone={blocked ? 'muted' : signal.direction === 'long' ? 'long' : 'short'}>
            {signal.direction === 'long' ? '▲ LONG' : '▼ SHORT'}
          </Badge>
          <Badge tone={blocked ? 'muted' : signal.grade === 'C' ? 'warn' : 'primary'}>
            {blocked ? 'BLOCKED' : signal.grade === 'C' ? 'C · Watch' : `Grade ${signal.grade}`}
          </Badge>
          <View className="ml-auto flex-row items-baseline gap-1">
            <Text className="font-mono text-sm font-semibold text-foreground">{signal.confidence}</Text>
            <Text className="text-[10px] text-subtle">/100</Text>
          </View>
        </View>

        <Text className="mt-1 text-xs text-subtle">
          {signal.setupType.replace(/_/g, ' ')} · {signal.timeframe} · {signal.session.replace(/_/g, ' ')} · {ageMin}m ago
        </Text>

        {blocked ? (
          <View className="mt-3 rounded-lg bg-muted p-2.5">
            <Text className="text-xs font-semibold text-subtle">NO TRADE — {signal.blockReasons[0]}</Text>
          </View>
        ) : (
          <View className="mt-3 flex-row flex-wrap gap-y-2">
            <Level label="Entry" value={signal.entry} digitsHint={d} locked={!canSee} />
            <Level label="Stop" value={signal.stopLoss} digitsHint={d} tone="short" locked={!canSee} />
            <Level label="TP1" value={signal.takeProfit1} digitsHint={d} tone="long" locked={!canSee} />
            <Level label="TP2" value={signal.takeProfit2} digitsHint={d} tone="long" locked={!canSee} />
            <View className="min-w-[30%] flex-1">
              <Text className="text-[10px] uppercase tracking-widest text-subtle">R:R</Text>
              <Text className="font-mono text-sm font-semibold text-foreground">
                {canSee ? `${signal.rrTp1.toFixed(2)} / ${signal.rrTp2.toFixed(2)}` : '•.•• / •.••'}
              </Text>
            </View>
          </View>
        )}

        {!canSee && !blocked && (
          <View className="mt-3 flex-row items-center justify-between rounded-lg bg-primary/10 px-3 py-2">
            <Text className="text-xs font-medium text-primary">Exact levels are a Pro feature</Text>
            <Text className="text-xs font-semibold text-primary">Unlock →</Text>
          </View>
        )}
      </Card>
    </Pressable>
  )
}
