import React from 'react'
import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  home: 'home-outline',
  signals: 'flash-outline',
  journal: 'book-outline',
  analytics: 'stats-chart-outline',
  profile: 'person-circle-outline',
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: '#070b12' },
        headerTintColor: '#dde3ee',
        headerShadowVisible: false,
        tabBarStyle: { backgroundColor: '#0c111c', borderTopColor: '#1c2333' },
        tabBarActiveTintColor: '#52a8ff',
        tabBarInactiveTintColor: '#8a93a6',
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={ICONS[route.name] ?? 'ellipse-outline'} size={size} color={color} />
        ),
      })}
    >
      <Tabs.Screen name="home" options={{ title: 'Home', headerTitle: 'FlowEdge' }} />
      <Tabs.Screen name="signals" options={{ title: 'Signals' }} />
      <Tabs.Screen name="journal" options={{ title: 'Journal' }} />
      <Tabs.Screen name="analytics" options={{ title: 'Analytics' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  )
}
