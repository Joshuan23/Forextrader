import React from 'react'
import { Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Btn, Card, Loading, Screen, SectionTitle, Stat } from '@/components/ui'
import { useJournal } from '@/hooks/useJournal'
import { useEntitlement } from '@/entitlements/context'
import { FREE_LIMITS, gates } from '@/entitlements/gating'
import { track } from '@/analytics/track'
import type { JournalRow } from '@/api/types'

function expectancy(rows: JournalRow[]) {
  const rs = rows.filter((r) => r.taken && typeof r.resultR === 'number').map((r) => r.resultR as number)
  const wins = rs.filter((r) => r > 0)
  const winRate = rs.length ? wins.length / rs.length : 0
  const totalR = rs.reduce((a, b) => a + b, 0)
  return { n: rs.length, winRate, totalR, expectancyR: rs.length ? totalR / rs.length : 0 }
}

function groupBy(rows: JournalRow[], key: (r: JournalRow) => string) {
  const m = new Map<string, JournalRow[]>()
  for (const r of rows) {
    const k = key(r)
    m.set(k, [...(m.get(k) ?? []), r])
  }
  return [...m.entries()].map(([k, list]) => ({ key: k, ...expectancy(list) }))
}

function BarRow({ label, value, display }: { label: string; value: number; display: string }) {
  return (
    <View className="flex-row items-center gap-2">
      <Text className="w-24 text-xs text-subtle">{label}</Text>
      <View className="h-2.5 flex-1 overflow-hidden rounded bg-muted">
        <View
          className={`h-full rounded ${value >= 0 ? 'bg-long' : 'bg-short'}`}
          style={{ width: `${Math.min(100, Math.abs(value) * 60)}%` }}
        />
      </View>
      <Text className={`w-16 text-right font-mono text-xs ${value >= 0 ? 'text-long' : 'text-short'}`}>
        {display}
      </Text>
    </View>
  )
}

export default function Analytics() {
  const router = useRouter()
  const { data: entries, isLoading } = useJournal()
  const { entitlement } = useEntitlement()
  const standard = gates.standardAnalytics(entitlement)
  const advanced = gates.advancedAnalytics(entitlement)

  if (isLoading || !entries) {
    return (
      <Screen scroll={false}>
        <Loading />
      </Screen>
    )
  }

  // Free tier: teaser window only.
  const cutoff = Date.now() - FREE_LIMITS.analyticsWindowDays * 24 * 60 * 60 * 1000
  const scoped = standard ? entries : entries.filter((e) => e.createdAt >= cutoff)
  const overall = expectancy(scoped)
  const byPair = groupBy(scoped, (r) => r.pair)
  const bySession = groupBy(scoped, (r) => r.session)
  const bySetup = groupBy(scoped, (r) => r.setupType)

  return (
    <Screen>
      <View className="flex-row gap-2">
        <Stat label="Trades" value={String(overall.n)} />
        <Stat label="Win rate" value={`${(overall.winRate * 100).toFixed(0)}%`} />
        <Stat
          label="Expectancy"
          value={`${overall.expectancyR >= 0 ? '+' : ''}${overall.expectancyR.toFixed(2)}R`}
          tone={overall.expectancyR >= 0 ? 'long' : 'short'}
        />
      </View>

      {!standard && (
        <Card className="mt-3 border-primary/40 bg-primary/10">
          <Text className="text-sm font-semibold text-primary">
            Free preview — last {FREE_LIMITS.analyticsWindowDays} days only
          </Text>
          <Text className="mt-0.5 text-xs text-subtle">
            Pro unlocks your full history, expectancy by setup, and the equity curve.
          </Text>
          <View className="mt-2">
            <Btn
              title="Unlock full analytics"
              onPress={() => {
                void track({ name: 'locked_feature_tapped', feature: 'analytics', plan: entitlement.plan })
                router.push({ pathname: '/paywall', params: { source: 'analytics' } })
              }}
            />
          </View>
        </Card>
      )}

      <SectionTitle>Expectancy by pair</SectionTitle>
      <Card className="gap-2">
        {byPair.map((g) => (
          <BarRow key={g.key} label={g.key} value={g.expectancyR} display={`${g.expectancyR >= 0 ? '+' : ''}${g.expectancyR.toFixed(2)}R`} />
        ))}
        {byPair.length === 0 && <Text className="text-xs text-subtle">No journal data in window.</Text>}
      </Card>

      <SectionTitle>Expectancy by session</SectionTitle>
      <Card className="gap-2">
        {bySession.map((g) => (
          <BarRow key={g.key} label={g.key.replace(/_/g, ' ')} value={g.expectancyR} display={`${g.expectancyR >= 0 ? '+' : ''}${g.expectancyR.toFixed(2)}R`} />
        ))}
        {bySession.length === 0 && <Text className="text-xs text-subtle">No journal data in window.</Text>}
      </Card>

      <SectionTitle>Setup performance {advanced ? '' : '· Elite'}</SectionTitle>
      {advanced ? (
        <Card className="gap-2">
          {bySetup.map((g) => (
            <BarRow key={g.key} label={g.key.replace(/_/g, ' ')} value={g.expectancyR} display={`${g.expectancyR >= 0 ? '+' : ''}${g.expectancyR.toFixed(2)}R`} />
          ))}
          {bySetup.length === 0 && <Text className="text-xs text-subtle">No journal data yet.</Text>}
        </Card>
      ) : (
        <Card className="items-center gap-2 py-6">
          <Text className="text-sm font-semibold text-foreground">Historical edge intelligence</Text>
          <Text className="px-4 text-center text-xs text-subtle">
            Setup × session expectancy, spread drag, and top setups by session are Elite features —
            the same feedback loop the engine itself uses.
          </Text>
          <Btn
            title="See Elite"
            variant="outline"
            onPress={() => router.push({ pathname: '/paywall', params: { source: 'analytics_elite' } })}
          />
        </Card>
      )}
    </Screen>
  )
}
