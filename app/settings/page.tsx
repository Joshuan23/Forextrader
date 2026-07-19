'use client'

import { useEffect, useState } from 'react'
import { SettingsForm } from '@/components/flowedge/settings-form'
import { STRATEGY_PROFILES } from '@/lib/engine/profiles'
import { CURRENCY_PAIRS } from '@/lib/forex/pairs'
import { fetchSettings, type SettingsResponse } from '@/lib/client/api'
import { ErrorState, LoadingState } from '@/components/flowedge/data-state'

export default function SettingsPage() {
  const [data, setData] = useState<SettingsResponse | null>(null)
  const [error, setError] = useState<unknown>(null)

  const load = () => {
    setError(null)
    fetchSettings().then(setData).catch(setError)
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [])

  if (error) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <ErrorState error={error} retry={load} />
      </div>
    )
  }
  if (!data) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <LoadingState />
      </div>
    )
  }

  // Real server-side configuration state — not client env guesses.
  const apiKeys = [
    { name: 'PostgreSQL (persistence)', envVar: 'DATABASE_URL', configured: data.services.database },
    { name: 'Alpha Vantage (candles)', envVar: 'ALPHA_VANTAGE_API_KEY', configured: data.services.alphaVantage },
    { name: 'Economic calendar (Finnhub)', envVar: 'CALENDAR_API_KEY', configured: data.services.calendar },
    { name: 'TradingView webhook secret', envVar: 'TRADINGVIEW_WEBHOOK_SECRET', configured: data.services.tradingviewWebhook },
    { name: 'Supabase admin (entitlements/push)', envVar: 'SUPABASE_SERVICE_ROLE_KEY', configured: data.services.supabaseAdmin },
    { name: 'RevenueCat sync', envVar: 'REVENUECAT_SECRET_KEY', configured: data.services.revenueCatSync },
  ]

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          The engine&apos;s guardrails. Changes apply to the next scan
          {data.persisted ? ' and persist to PostgreSQL' : ' (persistence requires DATABASE_URL)'}
          {data.demoMode ? ' — DEMO MODE is on: this deployment serves seeded demo data' : ''}.
        </p>
      </div>
      <SettingsForm
        settings={data.settings}
        allPairs={CURRENCY_PAIRS.map((p) => ({ symbol: p.symbol, name: p.name }))}
        profiles={STRATEGY_PROFILES.map(({ id, name, description, enabled }) => ({ id, name, description, enabled }))}
        apiKeys={apiKeys}
      />
    </div>
  )
}
