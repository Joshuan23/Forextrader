import React, { useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Btn, Card, Empty, Loading, Screen, SectionTitle } from '@/components/ui'
import { useAddJournalEntry, useJournal } from '@/hooks/useJournal'
import { useEntitlement } from '@/entitlements/context'
import { FREE_LIMITS, gates } from '@/entitlements/gating'
import { track } from '@/analytics/track'
import type { JournalRow } from '@/api/types'

const MISTAKES = ['chased_entry', 'moved_stop', 'oversized', 'news_gamble', 'cut_winner_early', 'revenge_trade']

export default function Journal() {
  const router = useRouter()
  const { data: entries, isLoading } = useJournal()
  const add = useAddJournalEntry()
  const { entitlement } = useEntitlement()
  const fullJournal = gates.fullJournal(entitlement)

  const [pair, setPair] = useState('EUR/USD')
  const [direction, setDirection] = useState<'long' | 'short'>('long')
  const [taken, setTaken] = useState(true)
  const [resultR, setResultR] = useState('')
  const [notes, setNotes] = useState('')
  const [mistakes, setMistakes] = useState<string[]>([])

  if (isLoading || !entries) {
    return (
      <Screen scroll={false}>
        <Loading />
      </Screen>
    )
  }

  const atLimit = !fullJournal && entries.length >= FREE_LIMITS.journalRows
  const visible = fullJournal ? entries : entries.slice(0, FREE_LIMITS.journalRows)

  const submit = () => {
    void track({ name: 'feature_used', feature: 'journal_add', plan: entitlement.plan })
    add.mutate({
      pair,
      direction,
      setupType: 'pullback_continuation',
      session: 'london',
      grade: 'B',
      taken,
      resultR: resultR ? Number(resultR) : undefined,
      mistakes,
      notes,
    } as Omit<JournalRow, 'id' | 'createdAt'>)
    setResultR('')
    setNotes('')
    setMistakes([])
  }

  return (
    <Screen>
      <SectionTitle>Log a trade or a skip</SectionTitle>
      {atLimit ? (
        <Card className="border-primary/40 bg-primary/10">
          <Text className="text-sm font-semibold text-primary">Journal limit reached</Text>
          <Text className="mt-0.5 text-xs text-subtle">
            Free accounts keep {FREE_LIMITS.journalRows} entries. Pro unlocks unlimited journaling
            with mistake tags and screenshots.
          </Text>
          <View className="mt-2">
            <Btn
              title="Upgrade to Pro"
              onPress={() => {
                void track({ name: 'locked_feature_tapped', feature: 'journal_limit', plan: entitlement.plan })
                router.push({ pathname: '/paywall', params: { source: 'journal_limit' } })
              }}
            />
          </View>
        </Card>
      ) : (
        <Card className="gap-2.5">
          <View className="flex-row gap-2">
            {['EUR/USD', 'GBP/USD', 'USD/JPY', 'XAU/USD'].map((p) => (
              <Pressable
                key={p}
                onPress={() => setPair(p)}
                className={`rounded-md border px-2 py-1 ${pair === p ? 'border-primary bg-primary/15' : 'border-border'}`}
              >
                <Text className={`text-xs ${pair === p ? 'text-primary' : 'text-subtle'}`}>{p}</Text>
              </Pressable>
            ))}
          </View>
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => setDirection('long')}
              className={`flex-1 items-center rounded-md border py-2 ${direction === 'long' ? 'border-long bg-long/15' : 'border-border'}`}
            >
              <Text className={`text-xs font-semibold ${direction === 'long' ? 'text-long' : 'text-subtle'}`}>LONG</Text>
            </Pressable>
            <Pressable
              onPress={() => setDirection('short')}
              className={`flex-1 items-center rounded-md border py-2 ${direction === 'short' ? 'border-short bg-short/15' : 'border-border'}`}
            >
              <Text className={`text-xs font-semibold ${direction === 'short' ? 'text-short' : 'text-subtle'}`}>SHORT</Text>
            </Pressable>
            <Pressable
              onPress={() => setTaken(!taken)}
              className="flex-1 items-center rounded-md border border-border py-2"
            >
              <Text className="text-xs font-semibold text-subtle">{taken ? 'TAKEN' : 'SKIPPED'}</Text>
            </Pressable>
          </View>
          <TextInput
            className="rounded-md border border-border bg-background px-3 py-2 font-mono text-sm text-foreground"
            placeholder="Result in R, e.g. +1.8 or -1.0"
            placeholderTextColor="#8a93a6"
            keyboardType="numbers-and-punctuation"
            value={resultR}
            onChangeText={setResultR}
          />
          <View className="flex-row flex-wrap gap-1.5">
            {MISTAKES.map((m) => {
              const active = mistakes.includes(m)
              return (
                <Pressable
                  key={m}
                  onPress={() => setMistakes(active ? mistakes.filter((x) => x !== m) : [...mistakes, m])}
                  className={`rounded-md border px-2 py-1 ${active ? 'border-short/60 bg-short/15' : 'border-border'}`}
                >
                  <Text className={`text-[11px] ${active ? 'text-short' : 'text-subtle'}`}>
                    {m.replace(/_/g, ' ')}
                  </Text>
                </Pressable>
              )
            })}
          </View>
          <TextInput
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            placeholder="Notes / screenshot URL"
            placeholderTextColor="#8a93a6"
            value={notes}
            onChangeText={setNotes}
          />
          <Btn title={add.isPending ? 'Saving…' : 'Log entry'} onPress={submit} disabled={add.isPending} />
        </Card>
      )}

      <SectionTitle>History{!fullJournal ? ` (last ${FREE_LIMITS.journalRows} — free plan)` : ''}</SectionTitle>
      <View className="gap-2">
        {visible.length === 0 ? (
          <Empty title="No entries yet" body="Log every signal — taken or skipped. Expectancy comes from honesty." />
        ) : (
          visible.map((e) => (
            <Card key={e.id} className="flex-row items-center gap-2 p-3">
              <Text className="w-20 text-sm font-semibold text-foreground">{e.pair}</Text>
              <Text className={`text-xs font-semibold ${e.direction === 'long' ? 'text-long' : 'text-short'}`}>
                {e.direction.toUpperCase()}
              </Text>
              <Text className="text-xs text-subtle">{e.taken ? 'taken' : 'skipped'}</Text>
              <Text
                className={`ml-auto font-mono text-sm font-semibold ${
                  (e.resultR ?? 0) > 0 ? 'text-long' : (e.resultR ?? 0) < 0 ? 'text-short' : 'text-subtle'
                }`}
              >
                {typeof e.resultR === 'number' ? `${e.resultR > 0 ? '+' : ''}${e.resultR.toFixed(2)}R` : '—'}
              </Text>
            </Card>
          ))
        )}
      </View>
    </Screen>
  )
}
