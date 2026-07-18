import { SettingsForm } from '@/components/flowedge/settings-form'
import { STRATEGY_PROFILES } from '@/lib/engine/profiles'
import { CURRENCY_PAIRS } from '@/lib/forex/pairs'
import { getSettings } from '@/lib/store/settings'
import { dbEnabled } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Settings' }

export default async function SettingsPage() {
  const settings = await getSettings()

  const apiKeys = [
    { name: 'Alpha Vantage (candles)', envVar: 'ALPHA_VANTAGE_API_KEY', configured: Boolean(process.env.ALPHA_VANTAGE_API_KEY) },
    { name: 'Economic calendar', envVar: 'CALENDAR_API_KEY', configured: Boolean(process.env.CALENDAR_API_KEY) },
    { name: 'PostgreSQL', envVar: 'DATABASE_URL', configured: dbEnabled() },
  ]

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          The engine&apos;s guardrails. Changes apply to the next scan{dbEnabled() ? ' and persist to PostgreSQL' : ' (in-memory until a database is configured)'}.
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
