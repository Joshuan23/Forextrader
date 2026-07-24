'use client'

import { useEffect, useState } from 'react'
import { fetchPoiStrategy, type PoiStrategyResponse, type PoiPlay } from '@/lib/client/api'
import { IctTabs } from '@/components/flowedge/ict-tabs'
import { ErrorState, LoadingState } from '@/components/flowedge/data-state'

export default function PoiStrategyPage() {
  const [data, setData] = useState<PoiStrategyResponse | null>(null)
  const [error, setError] = useState<unknown>(null)

  const load = () => {
    setError(null)
    setData(null)
    fetchPoiStrategy().then(setData).catch(setError)
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    load()
    const t = setInterval(load, 60_000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">POI Play</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Liquidity sweep → displacement leaves an Extreme POI → enter on the mitigation → run to the opposing liquidity.
        </p>
      </div>

      <IctTabs />

      {error ? (
        <ErrorState error={error} retry={load} />
      ) : !data ? (
        <LoadingState label="Scanning for sweep → POI setups…" />
      ) : (
        <>
          <div className="space-y-3">
            {data.pairs.map((p) => (
              <div key={p.symbol} className="rounded-lg border bg-card p-4">
                <div className="flex items-baseline justify-between">
                  <div className="font-mono text-sm font-semibold">{p.symbol}</div>
                  <div className="text-[11px] text-muted-foreground">{p.lastClose != null ? `@ ${p.lastClose}` : p.status ?? ''}</div>
                </div>
                {p.plan ? <PlanCard plan={p.plan} /> : (
                  <div className="mt-2 text-xs text-muted-foreground">
                    {p.status === 'insufficient_data' ? 'Not enough data yet.' : 'No armed POI play — waiting for a fresh sweep.'}
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="text-[11px] leading-5 text-muted-foreground">{data.note}</p>
        </>
      )}
    </div>
  )
}

function PlanCard({ plan }: { plan: PoiPlay }) {
  const short = plan.direction === 'short'
  const tone = short ? 'short' : 'long'
  return (
    <div className="mt-2 space-y-2.5">
      {/* Bias + state banner */}
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${short ? 'bg-short/15 text-short' : 'bg-long/15 text-long'}`}>
          {short ? 'SHORT' : 'LONG'}
        </span>
        <span className="text-[11px] font-medium text-foreground capitalize">{plan.bias}</span>
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
            plan.state === 'mitigating' ? 'bg-amber-500/15 text-amber-500' : 'bg-secondary text-muted-foreground'
          }`}
        >
          {plan.state === 'mitigating' ? '● MITIGATING NOW — trigger' : 'WAITING for price to reach POI'}
        </span>
        <span className="ml-auto text-[11px] text-muted-foreground">
          {plan.distancePips} pips to entry · {plan.riskReward}R
        </span>
      </div>

      {/* Sequence: sweep → POI → target */}
      <div className="rounded-md border border-border bg-background/50 p-2.5 text-[11px] leading-5 text-muted-foreground">
        <span className="text-foreground">{plan.sweepType === 'buyside' ? 'Buyside' : 'Sellside'} stop hunt</span> at{' '}
        <span className="font-mono text-foreground">{plan.sweepLevel}</span> → Extreme POI{' '}
        <span className="font-mono text-foreground">{plan.poiBottom}–{plan.poiTop}</span> → target{' '}
        <span className="font-mono text-foreground">{plan.takeProfit}</span>{' '}
        {plan.targetIsLiquidity ? `(${short ? 'sell' : 'buy'}-side $$$)` : '(min R:R)'}
      </div>

      {/* Entry / Stop / Target */}
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <Cell label="Entry (POI)" value={plan.entry} tone={tone} />
        <Cell label="Stop" value={plan.stopLoss} tone={short ? 'long' : 'short'} />
        <Cell label="Target ($$$)" value={plan.takeProfit} tone={tone} />
      </div>
    </div>
  )
}

function Cell({ label, value, tone }: { label: string; value: number; tone?: 'long' | 'short' }) {
  return (
    <div className="rounded-md border border-border bg-background/50 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`font-mono font-semibold ${tone === 'long' ? 'text-long' : tone === 'short' ? 'text-short' : 'text-foreground'}`}>{value}</div>
    </div>
  )
}
