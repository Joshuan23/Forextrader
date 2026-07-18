import React, { useState } from 'react'
import { Text, TextInput, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Btn, Card, Screen } from '@/components/ui'
import { getSupabase } from '@/lib/supabase'
import { useEntitlement } from '@/entitlements/context'

export default function SignIn() {
  const router = useRouter()
  const { refresh } = useEntitlement()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'signin' | 'signup' | 'magic'>('signin')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const supabase = getSupabase()

  async function submit() {
    if (!supabase) {
      setMessage('Auth is not configured in this build (mock mode) — continuing as guest.')
      setTimeout(() => router.back(), 900)
      return
    }
    setBusy(true)
    setMessage(null)
    try {
      if (mode === 'magic') {
        const { error } = await supabase.auth.signInWithOtp({ email })
        setMessage(error ? error.message : 'Magic link sent — check your email.')
      } else if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        await refresh()
        router.back()
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        await refresh()
        router.back()
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Authentication failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen scroll={false}>
      <View className="flex-1 justify-center gap-3">
        <Card className="gap-3">
          <Text className="text-lg font-semibold text-foreground">
            {mode === 'signup' ? 'Create account' : mode === 'magic' ? 'Magic link' : 'Sign in'}
          </Text>
          <TextInput
            className="rounded-lg border border-border bg-background px-3 py-3 text-sm text-foreground"
            placeholder="Email"
            placeholderTextColor="#8a93a6"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          {mode !== 'magic' && (
            <TextInput
              className="rounded-lg border border-border bg-background px-3 py-3 text-sm text-foreground"
              placeholder="Password"
              placeholderTextColor="#8a93a6"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          )}
          {message && <Text className="text-xs text-warn">{message}</Text>}
          <Btn
            title={busy ? 'Working…' : mode === 'signup' ? 'Sign up' : mode === 'magic' ? 'Send link' : 'Sign in'}
            onPress={() => void submit()}
            disabled={busy || email.length < 4}
          />
        </Card>
        <Btn
          title={mode === 'signin' ? 'New here? Create an account' : 'Have an account? Sign in'}
          variant="ghost"
          onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
        />
        <Btn title="Use a magic link instead" variant="ghost" onPress={() => setMode('magic')} />
      </View>
    </Screen>
  )
}
