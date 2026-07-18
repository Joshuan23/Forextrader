import React, { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Btn, Card, Screen } from '@/components/ui'
import { DEFAULT_PREFS, savePrefs, type UserPrefs } from '@/lib/prefs'
import { registerForPush } from '@/notifications/push'
import { track } from '@/analytics/track'

const STEPS = ['welcome', 'focus', 'pairs', 'sessions', 'notifications', 'account', 'offer'] as const
type Step = (typeof STEPS)[number]

const ALL_PAIRS = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD', 'XAU/USD']
const ALL_SESSIONS = [
  { id: 'london', label: 'London' },
  { id: 'newyork', label: 'New York' },
  { id: 'london_ny_overlap', label: 'London/NY overlap' },
  { id: 'asia', label: 'Asia' },
]

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-lg border px-3 py-2 ${active ? 'border-primary bg-primary/15' : 'border-border bg-card'}`}
    >
      <Text className={`text-sm font-medium ${active ? 'text-primary' : 'text-foreground'}`}>{label}</Text>
    </Pressable>
  )
}

export default function Onboarding() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('welcome')
  const [prefs, setPrefs] = useState<UserPrefs>(DEFAULT_PREFS)

  const next = () => {
    const i = STEPS.indexOf(step)
    void track({ name: 'onboarding_step', step })
    if (i < STEPS.length - 1) setStep(STEPS[i + 1])
  }

  const finish = async (showPaywall: boolean) => {
    await savePrefs({ ...prefs, onboarded: true })
    void track({ name: 'onboarding_completed' })
    router.replace('/(tabs)/home')
    if (showPaywall) setTimeout(() => router.push({ pathname: '/paywall', params: { source: 'onboarding' } }), 350)
  }

  return (
    <Screen scroll={false}>
      <View className="flex-1 justify-center gap-4">
        {step === 'welcome' && (
          <>
            <Text className="text-3xl font-bold text-foreground">FlowEdge</Text>
            <Text className="text-base leading-6 text-subtle">
              Disciplined forex trade plans: exact entry, stop, and targets — every signal validated
              against session, news, volatility, and execution quality before it reaches you.
            </Text>
            <Btn title="Get started" onPress={next} />
          </>
        )}

        {step === 'focus' && (
          <>
            <Text className="text-xl font-semibold text-foreground">How do you trade?</Text>
            <View className="gap-2">
              {(['scalp', 'intraday', 'swing'] as const).map((f) => (
                <Chip
                  key={f}
                  label={f === 'scalp' ? 'Scalping — minutes' : f === 'intraday' ? 'Intraday — hours' : 'Swing — days'}
                  active={prefs.tradingFocus === f}
                  onPress={() => setPrefs({ ...prefs, tradingFocus: f })}
                />
              ))}
            </View>
            <Btn title="Continue" onPress={next} />
          </>
        )}

        {step === 'pairs' && (
          <>
            <Text className="text-xl font-semibold text-foreground">Your pairs</Text>
            <View className="flex-row flex-wrap gap-2">
              {ALL_PAIRS.map((p) => (
                <Chip
                  key={p}
                  label={p}
                  active={prefs.pairs.includes(p)}
                  onPress={() =>
                    setPrefs({
                      ...prefs,
                      pairs: prefs.pairs.includes(p) ? prefs.pairs.filter((x) => x !== p) : [...prefs.pairs, p],
                    })
                  }
                />
              ))}
            </View>
            <Btn title="Continue" onPress={next} disabled={prefs.pairs.length === 0} />
          </>
        )}

        {step === 'sessions' && (
          <>
            <Text className="text-xl font-semibold text-foreground">Your sessions</Text>
            <View className="flex-row flex-wrap gap-2">
              {ALL_SESSIONS.map((s) => (
                <Chip
                  key={s.id}
                  label={s.label}
                  active={prefs.sessions.includes(s.id)}
                  onPress={() =>
                    setPrefs({
                      ...prefs,
                      sessions: prefs.sessions.includes(s.id)
                        ? prefs.sessions.filter((x) => x !== s.id)
                        : [...prefs.sessions, s.id],
                    })
                  }
                />
              ))}
            </View>
            <Btn title="Continue" onPress={next} disabled={prefs.sessions.length === 0} />
          </>
        )}

        {step === 'notifications' && (
          <>
            <Text className="text-xl font-semibold text-foreground">Signal alerts</Text>
            <Text className="text-sm text-subtle">
              Get notified the moment a signal is approved. Pro unlocks per-signal alerts; you can
              tune preferences later.
            </Text>
            <Btn
              title="Enable notifications"
              onPress={() => {
                void registerForPush('free').then((token) =>
                  setPrefs({ ...prefs, notificationsEnabled: Boolean(token) })
                )
                next()
              }}
            />
            <Btn title="Not now" variant="ghost" onPress={next} />
          </>
        )}

        {step === 'account' && (
          <>
            <Text className="text-xl font-semibold text-foreground">Create your account</Text>
            <Text className="text-sm text-subtle">
              Your journal, analytics, and subscription follow your account across devices.
            </Text>
            <Btn title="Sign up / Sign in" onPress={() => router.push('/sign-in')} />
            <Btn title="Continue without account" variant="ghost" onPress={next} />
          </>
        )}

        {step === 'offer' && (
          <>
            <Text className="text-xl font-semibold text-foreground">Trade with the full engine</Text>
            <Card>
              <Text className="text-sm leading-6 text-subtle">
                Pro unlocks every live signal with exact entry, stop, TP1/TP2, full reasoning, and
                push alerts. Try it free for 7 days.
              </Text>
            </Card>
            <Btn title="See plans" onPress={() => void finish(true)} />
            <Btn title="Explore the free app first" variant="ghost" onPress={() => void finish(false)} />
          </>
        )}

        <View className="flex-row justify-center gap-1.5 pb-4 pt-2">
          {STEPS.map((s) => (
            <View key={s} className={`h-1.5 w-6 rounded-full ${s === step ? 'bg-primary' : 'bg-muted'}`} />
          ))}
        </View>
      </View>
    </Screen>
  )
}
