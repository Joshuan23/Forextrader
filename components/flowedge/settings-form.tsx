'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { updateSettings, type SettingsFormState } from '@/app/actions/settings'
import type { FlowEdgeSettings, SessionTag } from '@/lib/engine/types'
import { SESSION_LABELS } from '@/lib/engine/types'
import type { StrategyProfileDef } from '@/lib/engine/profiles'

const initialState: SettingsFormState = { ok: false }

function SaveButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Saving…' : 'Save settings'}
    </Button>
  )
}

interface ApiKeyStatus {
  name: string
  envVar: string
  configured: boolean
}

export function SettingsForm({
  settings,
  allPairs,
  profiles,
  apiKeys,
}: {
  settings: FlowEdgeSettings
  allPairs: { symbol: string; name: string }[]
  profiles: Pick<StrategyProfileDef, 'id' | 'name' | 'description' | 'enabled'>[]
  apiKeys: ApiKeyStatus[]
}) {
  const [state, formAction] = useFormState(updateSettings, initialState)
  const w = settings.signalWeights

  return (
    <form action={formAction} className="space-y-4">
      {/* API keys */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Data Provider API Keys</CardTitle>
          <CardDescription>
            Keys are read from environment variables — set them in <code className="font-mono">.env.local</code> (or Vercel).
            In production, missing required services fail loudly; simulated providers require DEVELOPMENT_DEMO_MODE=true.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-3">
          {apiKeys.map((k) => (
            <div key={k.envVar} className="rounded-md border p-2.5 text-xs">
              <div className="font-medium">{k.name}</div>
              <div className="mt-0.5 flex items-center justify-between">
                <code className="text-muted-foreground">{k.envVar}</code>
                <span className={k.configured ? 'text-long' : 'text-muted-foreground'}>
                  {k.configured ? 'configured' : 'not set'}
                </span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Strategy profile */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Strategy Profile</CardTitle>
          <CardDescription>Constrains sessions, setups, and regimes the engine may trade.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Select name="activeProfileId" defaultValue={settings.activeProfileId} className="max-w-sm">
            {profiles.map((p) => (
              <option key={p.id} value={p.id} disabled={!p.enabled}>
                {p.name}{!p.enabled ? ' (disabled)' : ''}
              </option>
            ))}
          </Select>
          <div className="grid gap-1.5 text-xs text-muted-foreground sm:grid-cols-2">
            {profiles.map((p) => (
              <div key={p.id}>
                <span className="font-medium text-foreground">{p.name}:</span> {p.description}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Pair whitelist */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Pair Whitelist</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {allPairs.map((p) => (
            <label key={p.symbol} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="pairWhitelist"
                value={p.symbol}
                defaultChecked={settings.pairWhitelist.includes(p.symbol)}
                className="h-4 w-4 accent-[#3d8ef5]"
              />
              {p.symbol}
            </label>
          ))}
        </CardContent>
      </Card>

      {/* Thresholds */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Execution & Volatility Thresholds</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Max spread (pips, default)" name="defaultMaxSpread" defaultValue={settings.maxSpreadPips['default'] ?? 2} step="0.1" />
          <Field label="Min ATR (pips)" name="minAtrPips" defaultValue={settings.minAtrPips} step="0.5" />
          <Field label="Max ATR (× median)" name="maxAtrMultiple" defaultValue={settings.maxAtrMultiple} step="0.5" />
          <Field label="Min reward:risk (TP2)" name="minRiskReward" defaultValue={settings.minRiskReward} step="0.1" />
        </CardContent>
      </Card>

      {/* Sessions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Session Filters</CardTitle>
          <CardDescription>Sessions where new signals are allowed at all.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {(Object.keys(SESSION_LABELS) as SessionTag[]).map((tag) => (
            <label key={tag} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name={`session_${tag}`}
                defaultChecked={settings.sessionFilters[tag]}
                className="h-4 w-4 accent-[#3d8ef5]"
              />
              {SESSION_LABELS[tag]}
            </label>
          ))}
        </CardContent>
      </Card>

      {/* News blackout */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">News Blackout Windows</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Minutes before high-impact" name="newsBlackoutBeforeMin" defaultValue={settings.newsBlackoutBeforeMin} step="5" />
          <Field label="Minutes after high-impact" name="newsBlackoutAfterMin" defaultValue={settings.newsBlackoutAfterMin} step="5" />
          <label className="col-span-2 flex items-center gap-2 self-end text-sm">
            <input
              type="checkbox"
              name="centralBankDowngrade"
              defaultChecked={settings.centralBankDowngrade}
              className="h-4 w-4 accent-[#3d8ef5]"
            />
            Downweight signals on central-bank days
          </label>
        </CardContent>
      </Card>

      {/* Risk model */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Risk Model</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Risk per trade (%)" name="riskPerTradePct" defaultValue={settings.riskPerTradePct} step="0.05" />
          <Field label="Account size (USD)" name="accountSize" defaultValue={settings.accountSize} step="1000" />
          <Field label="Min confidence (0–100)" name="minConfidence" defaultValue={settings.minConfidence} step="1" />
        </CardContent>
      </Card>

      {/* Signal weights */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Signal Weights</CardTitle>
          <CardDescription>
            Normalised at scoring time. Spec defaults: structure .35, HTF .20, session .15, volatility .10, event .10, execution .10.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-6">
          <Field label="Structure" name="w_structure" defaultValue={w.structure} step="0.01" />
          <Field label="HTF bias" name="w_htfBias" defaultValue={w.htfBias} step="0.01" />
          <Field label="Session" name="w_session" defaultValue={w.session} step="0.01" />
          <Field label="Volatility" name="w_regime" defaultValue={w.regime} step="0.01" />
          <Field label="Event risk" name="w_eventRisk" defaultValue={w.eventRisk} step="0.01" />
          <Field label="Execution" name="w_execution" defaultValue={w.execution} step="0.01" />
        </CardContent>
      </Card>

      {/* Broker assumptions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Broker / Execution Assumptions</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Commission per lot (USD)" name="commissionPerLotUsd" defaultValue={settings.brokerAssumptions.commissionPerLotUsd} step="0.5" />
          <Field label="Assumed slippage (pips)" name="assumedSlippagePips" defaultValue={settings.brokerAssumptions.assumedSlippagePips} step="0.05" />
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <SaveButton />
        {state.error && <span className="text-xs text-destructive">{state.error}</span>}
        {state.ok && <span className="text-xs text-long">Saved — the next scan uses these settings.</span>}
      </div>
    </form>
  )
}

function Field({
  label,
  name,
  defaultValue,
  step,
}: {
  label: string
  name: string
  defaultValue: number
  step?: string
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={`f-${name}`}>{label}</Label>
      <Input id={`f-${name}`} name={name} type="number" step={step} defaultValue={defaultValue} />
    </div>
  )
}
