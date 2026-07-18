import React from 'react'
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

// Small design-system primitives — restrained, dark, institutional.

export function Screen({ children, scroll = true }: { children: React.ReactNode; scroll?: boolean }) {
  const body = scroll ? (
    <ScrollView className="flex-1" contentContainerClassName="px-4 pb-10 pt-2">
      {children}
    </ScrollView>
  ) : (
    <View className="flex-1 px-4 pt-2">{children}</View>
  )
  return <SafeAreaView className="flex-1 bg-background" edges={['top']}>{body}</SafeAreaView>
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <View className={`rounded-xl border border-border bg-card p-4 ${className}`}>{children}</View>
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Text className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-widest text-subtle">
      {children}
    </Text>
  )
}

export function Badge({
  children,
  tone = 'muted',
}: {
  children: React.ReactNode
  tone?: 'long' | 'short' | 'warn' | 'primary' | 'muted'
}) {
  const tones: Record<string, { bg: string; fg: string }> = {
    long: { bg: 'bg-long/15', fg: 'text-long' },
    short: { bg: 'bg-short/15', fg: 'text-short' },
    warn: { bg: 'bg-warn/15', fg: 'text-warn' },
    primary: { bg: 'bg-primary/15', fg: 'text-primary' },
    muted: { bg: 'bg-muted', fg: 'text-subtle' },
  }
  const t = tones[tone]
  return (
    <View className={`rounded-md px-2 py-0.5 ${t.bg}`}>
      <Text className={`text-[11px] font-semibold ${t.fg}`}>{children}</Text>
    </View>
  )
}

export function Btn({
  title,
  onPress,
  variant = 'primary',
  disabled,
}: {
  title: string
  onPress: () => void
  variant?: 'primary' | 'outline' | 'ghost'
  disabled?: boolean
}) {
  const base = 'items-center justify-center rounded-lg px-4 py-3'
  const styles: Record<string, { box: string; text: string }> = {
    primary: { box: 'bg-primary', text: 'text-background font-semibold' },
    outline: { box: 'border border-border bg-transparent', text: 'text-foreground font-medium' },
    ghost: { box: 'bg-transparent', text: 'text-subtle font-medium' },
  }
  const s = styles[variant]
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`${base} ${s.box} ${disabled ? 'opacity-50' : 'active:opacity-80'}`}
    >
      <Text className={`text-sm ${s.text}`}>{title}</Text>
    </Pressable>
  )
}

export function Stat({ label, value, tone }: { label: string; value: string; tone?: 'long' | 'short' }) {
  return (
    <Card className="flex-1 p-3">
      <Text className="text-[10px] uppercase tracking-widest text-subtle">{label}</Text>
      <Text
        className={`mt-0.5 font-mono text-base font-semibold ${
          tone === 'long' ? 'text-long' : tone === 'short' ? 'text-short' : 'text-foreground'
        }`}
      >
        {value}
      </Text>
    </Card>
  )
}

export function Loading() {
  return (
    <View className="flex-1 items-center justify-center py-16">
      <ActivityIndicator color="#52a8ff" />
    </View>
  )
}

export function Empty({ title, body }: { title: string; body?: string }) {
  return (
    <Card className="items-center py-8">
      <Text className="text-sm font-semibold text-foreground">{title}</Text>
      {body ? <Text className="mt-1 px-4 text-center text-xs text-subtle">{body}</Text> : null}
    </Card>
  )
}
