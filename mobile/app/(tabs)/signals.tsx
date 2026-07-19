import React, { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Empty, Loading, Screen } from '@/components/ui'
import { SignalCard } from '@/components/SignalCard'
import { useSignals } from '@/hooks/useSignals'
import { useEntitlement } from '@/entitlements/context'
import { freeSignalAllowance, gates } from '@/entitlements/gating'

const GRADES = ['all', 'A', 'B', 'C', 'blocked'] as const

export default function Signals() {
  const { data: signals, isLoading, refetch } = useSignals()
  const { entitlement } = useEntitlement()
  const [grade, setGrade] = useState<(typeof GRADES)[number]>('all')

  if (isLoading || !signals) {
    return (
      <Screen scroll={false}>
        <Loading />
      </Screen>
    )
  }

  const allowance = freeSignalAllowance(signals.filter((s) => s.status === 'approved'))
  const filtered = signals.filter((s) => (grade === 'all' ? true : s.grade === grade))

  return (
    <Screen>
      {/* Sticky-feel filter row */}
      <View className="mb-3 flex-row gap-2">
        {GRADES.map((g) => (
          <Pressable
            key={g}
            onPress={() => setGrade(g)}
            className={`rounded-lg border px-3 py-1.5 ${
              grade === g ? 'border-primary bg-primary/15' : 'border-border bg-card'
            }`}
          >
            <Text className={`text-xs font-medium ${grade === g ? 'text-primary' : 'text-subtle'}`}>
              {g === 'all' ? 'All' : g === 'blocked' ? 'Blocked' : g}
            </Text>
          </Pressable>
        ))}
      </View>

      <View className="gap-3">
        {filtered.length === 0 ? (
          <Empty title="Nothing here" body="No signals match this filter right now." />
        ) : (
          filtered.map((s) => (
            <SignalCard
              key={s.id}
              signal={s}
              unlockedForFree={!gates.exactLevels(entitlement) && allowance.has(s.id)}
            />
          ))
        )}
      </View>

      <Pressable onPress={() => void refetch()} className="mt-4 items-center py-2">
        <Text className="text-xs text-subtle">Pull to refresh · tap to rescan</Text>
      </Pressable>
    </Screen>
  )
}
