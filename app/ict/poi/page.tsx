'use client'

import { useEffect, useState } from 'react'
import { fetchPoi, type PoiResponse } from '@/lib/client/api'
import { IctTabs } from '@/components/flowedge/ict-tabs'
import { ErrorState, LoadingState } from '@/components/flowedge/data-state'

export default function PoiPage() {
  const [data, setData] = useState<PoiResponse | null>(null)
  const [error, setError] = useState<unknown>(null)

  const load = () => {
    setError(null)
    setData(null)
    fetchPoi().then(setData).catch(setError)
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [])

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Points of Interest</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Unmitigated Order Blocks &amp; Fair Value Gaps — limit-entry zones price hasn&apos;t returned to yet.
        </p>
      </div>

      <IctTabs />

      {error ? (
        <ErrorState error={error} retry={load} />
      ) : !data ? (
        <LoadingState label="Scanning zones on every pair…" />
      ) : (
        <>
          <div className="space-y-3">
            {data.pairs.map((p) => (
              <div key={p.symbol} className="rounded-lg border bg-card p-4">
                <div className="flex items-baseline justify-between">
                  <div className="font-mono text-sm font-semibold">{p.symbol}</div>
                  <div className="text-[11px] text-muted-foreground">{p.lastClose != null ? `@ ${p.lastClose}` : ''}</div>
                </div>
                {!p.pois || p.pois.length === 0 ? (
                  <div className="mt-2 text-xs text-muted-foreground">No fresh POIs right now.</div>
                ) : (
                  <div className="mt-2 space-y-2">
                    {p.pois.map((poi, idx) => (
                      <div key={idx} className="rounded-md border border-border bg-background/50 p-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${poi.direction === 'long' ? 'bg-long/15 text-long' : 'bg-short/15 text-short'}`}>
                              {poi.direction === 'long' ? 'LONG' : 'SHORT'}
                            </span>
                            <span className="text-[11px] font-medium text-foreground">
                              {poi.kind === 'FVG' ? 'Fair Value Gap' : 'Order Block'}
                            </span>
                          </div>
                          <span className="text-[11px] text-muted-foreground">{poi.distancePips} pips away · {poi.riskReward}R</span>
                        </div>
                        <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
                          <Cell label="Entry" value={poi.entry} />
                          <Cell label="Stop" value={poi.stopLoss} tone="short" />
                          <Cell label="Target" value={poi.takeProfit} tone="long" />
                        </div>
                        <div className="mt-1 text-center text-[10px] text-muted-foreground">
                          Zone {poi.bottom} – {poi.top}
                        </div>
                      </div>
                    ))}
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

function Cell({ label, value, tone }: { label: string; value: number; tone?: 'long' | 'short' }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`font-mono font-semibold ${tone === 'long' ? 'text-long' : tone === 'short' ? 'text-short' : 'text-foreground'}`}>{value}</div>
    </div>
  )
}
