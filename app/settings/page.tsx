'use client'

import { useEffect, useState } from 'react'
import { SettingsForm } from '@/components/flowedge/settings-form'
import { STRATEGY_PROFILES } from '@/lib/engine/profiles'
import { CURRENCY_PAIRS } from '@/lib/forex/pairs'
import { getSettings } from '@/lib/store/settings'
import type { FlowEdgeSettings } from '@/lib/engine/types'

export default function SettingsPage() {
  const [settings, setSettings] = useState<FlowEdgeSettings | null>(null)

  useEffect(() => {
    getSettings().then(setSettings)
  }, [])

  if (!settings) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  const apiKeys = [
    { name: 'Alpha Vantage (candles)', envVar: 'ALPHA_VANTAGE_API_KEY', configured: Boolean(process.env.ALPHA_VANTAGE_API_KEY) },
    { name: 'Economic calendar', envVar: 'CALENDAR_API_KEY', configured: Boolean(process.env.CALENDAR_API_KEY) },
    { name: 'PostgreSQL', envVar: 'DATABASE_URL', configured: Boolean(process.env.DATABASE_URL) },
  ]

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          The engine&apos;s guardrails. Changes apply to the next scan{process.env.DATABASE_URL ? ' and persist to PostgreSQL' : ' (in-memory until a database is configured)'}.
        </p>
      </div>
      <SettingsForm
        settings={settings}
        allPairs={CURRENCY_PAIRS.map((p) => ({ symbol: p.symbol, name: p.name }))}
        profiles={STRATEGY_PROFILES.map(({ id, name, description, enabled }) => ({ id, name, description, enabled }))}
        apiKeys={apiKeys}
      />
    </div>
  )
}
