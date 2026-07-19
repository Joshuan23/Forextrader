import React from 'react'
import { Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Badge, Btn, Card, Empty, Loading, Screen, SectionTitle } from '@/components/ui'
import { useSignals } from '@/hooks/useSignals'
import { useEntitlement } from '@/entitlements/context'
import { gates } from '@/entitlements/gating'
import { track } from '@/analytics/track'

function digitsFor(pair: string): number {
  if (pair.includes('JPY')) return 3
  if (pair.startsWith('XAU')) return 2
  return 4
}

export default function SignalDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { data: signals, isLoading } = useSignals()
  const { entitlement } = useEntitlement()

  if (isLoading || !signals) {
    return (
      <Screen scroll={false}>
        <Loading />
      </Screen>
    )
  }
  const signal = signals.find((s) => s.id === id)
  if (!signal) {
    return (
      <Screen>
        <Empty title="Signal expired" body="This plan is no longer active." />
      </Screen>
    )
  }

  const d = digitsFor(signal.pair)
  const blocked = signal.status === 'blocked'
  const canExplain = gates.fullExplanations(entitlement)
  const canDeep = gates.deepReasoning(entitlement)

  return (
    <Screen>
      <View className="flex-row flex-wrap items-center gap-2">
        <Text className="text-xl font-bold text-foreground">{signal.pair}</Text>
        <Badge tone={blocked ? 'muted' : signal.direction === 'long' ? 'long' : 'short'}>
          {signal.direction === 'long' ? '▲ LONG' : '▼ SHORT'}
        </Badge>
        <Badge tone={blocked ? 'muted' : 'primary'}>{blocked ? 'BLOCKED' : `Grade ${signal.grade}`}</Badge>
        <Text className="ml-auto font-mono text-lg font-semibold text-foreground">{signal.confidence}</Text>
      </View>
      <Text className="mt-1 text-xs text-subtle">
        {signal.setupType.replace(/_/g, ' ')} · {signal.timeframe} · {signal.session.replace(/_/g, ' ')} · HTF {signal.htfBias}
      </Text>

      {/* Exact levels */}
      <SectionTitle>Trade plan</SectionTitle>
      <Card className="gap-2">
        {[
          ['Entry', signal.entry, ''],
          ['Stop', signal.stopLoss, 'short'],
          ['TP1', signal.takeProfit1, 'long'],
          ['TP2', signal.takeProfit2, 'long'],
          ...(signal.takeProfit3 ? ([['TP3', signal.takeProfit3, 'long']] as const) : []),
        ].map(([label, value, tone]) => (
          <View key={String(label)} className="flex-row items-center justify-between">
            <Text className="text-xs uppercase tracking-widest text-subtle">{label}</Text>
            <Text
              className={`font-mono text-base font-semibold ${
                tone === 'long' ? 'text-long' : tone === 'short' ? 'text-short' : 'text-foreground'
              }`}
            >
              {(value as number).toFixed(d)}
            </Text>
          </View>
        ))}
        <View className="flex-row items-center justify-between border-t border-border pt-2">
          <Text className="text-xs uppercase tracking-widest text-subtle">R:R (TP1 / TP2)</Text>
          <Text className="font-mono text-sm text-foreground">
            {signal.rrTp1.toFixed(2)} / {signal.rrTp2.toFixed(2)}
          </Text>
        </View>
      </Card>

      {blocked && (
        <>
          <SectionTitle>Why NO TRADE</SectionTitle>
          <Card className="gap-1">
            {signal.blockReasons.map((r, i) => (
              <Text key={i} className="text-sm text-subtle">• {r}</Text>
            ))}
          </Card>
        </>
      )}

      <SectionTitle>Conditions</SectionTitle>
      <View className="flex-row flex-wrap gap-2">
        <Badge tone="muted">spread {signal.spreadPips.toFixed(1)}p</Badge>
        <Badge tone={signal.eventRisk === 'high' ? 'short' : signal.eventRisk === 'medium' ? 'warn' : 'muted'}>
          event risk {signal.eventRisk}
        </Badge>
        <Badge tone="muted">{signal.regime.replace(/_/g, ' ')}</Badge>
      </View>

      <SectionTitle>Invalidation</SectionTitle>
      <Card>
        <Text className="text-sm leading-5 text-subtle">{signal.invalidation}</Text>
      </Card>

      <SectionTitle>Reasoning</SectionTitle>
      {canExplain ? (
        <Card>
          <Text className="text-sm leading-6 text-subtle">{signal.explanation}</Text>
        </Card>
      ) : (
        <LockedBlock
          title="Full reasoning is a Pro feature"
          body="Why this setup was approved: HTF alignment, session quality, execution state, and event context — in plain English."
          onPress={() => {
            void track({ name: 'locked_feature_tapped', feature: 'explanation', plan: entitlement.plan })
            router.push({ pathname: '/paywall', params: { source: 'signal_detail' } })
          }}
        />
      )}

      <SectionTitle>Score derivation · Elite</SectionTitle>
      {canDeep ? (
        <Card className="gap-2.5">
          <Text className="font-mono text-[11px] leading-5 text-subtle">{signal.confidenceEquation}</Text>
          {signal.layerScores.map((l) => (
            <View key={l.label}>
              <View className="flex-row justify-between">
                <Text className="text-xs font-medium text-foreground">{l.label}</Text>
                <Text className="font-mono text-xs text-foreground">{l.score}</Text>
              </View>
              <Text className="text-[11px] leading-4 text-subtle">{l.rule}</Text>
            </View>
          ))}
          {signal.derivations.map((dv) => (
            <View key={dv.level} className="rounded-md bg-muted p-2">
              <Text className="text-xs font-semibold text-foreground">
                {dv.level} = {dv.value}
              </Text>
              <Text className="font-mono text-[11px] text-subtle">{dv.formula} → {dv.computation}</Text>
            </View>
          ))}
        </Card>
      ) : (
        <LockedBlock
          title="Layer-by-layer derivation is Elite"
          body="The exact confidence equation and the formula behind every level — entry, stop, TP1, TP2."
          onPress={() => {
            void track({ name: 'locked_feature_tapped', feature: 'derivations', plan: entitlement.plan })
            router.push({ pathname: '/paywall', params: { source: 'signal_detail_elite' } })
          }}
        />
      )}
    </Screen>
  )
}

function LockedBlock({ title, body, onPress }: { title: string; body: string; onPress: () => void }) {
  return (
    <Card className="items-start gap-2 border-primary/30">
      <Text className="text-sm font-semibold text-foreground">🔒 {title}</Text>
      <Text className="text-xs leading-5 text-subtle">{body}</Text>
      <Btn title="Unlock" variant="outline" onPress={onPress} />
    </Card>
  )
}
