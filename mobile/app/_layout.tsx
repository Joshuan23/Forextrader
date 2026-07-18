import '../global.css'
import React from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { EntitlementProvider } from '@/entitlements/context'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
})

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <EntitlementProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: '#070b12' },
            headerTintColor: '#dde3ee',
            headerTitleStyle: { fontWeight: '600' },
            contentStyle: { backgroundColor: '#070b12' },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="sign-in" options={{ title: 'Sign in' }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="signal/[id]" options={{ title: 'Trade Plan', presentation: 'card' }} />
          <Stack.Screen name="paywall" options={{ presentation: 'modal', title: 'Upgrade' }} />
          <Stack.Screen name="billing" options={{ title: 'Billing' }} />
        </Stack>
      </EntitlementProvider>
    </QueryClientProvider>
  )
}
