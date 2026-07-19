'use client'

import { useEffect, useState } from 'react'
import { SignalsList } from '@/components/flowedge/signals-list'
import { TvInbox } from '@/components/flowedge/tv-inbox'
import { fetchFullScan, fetchInboxSignals } from '@/lib/client/api'
import { ErrorState, LoadingState } from '@/components/flowedge/data-state'
import type { EngineSignal } from '@/lib/engine/types'

export default function SignalsPage() {
  const [data, setData] = useState<{
    signals: EngineSignal[]
    tvSignals: EngineSignal[]
  } | null>(null)
  const [error, setError] = useState<unknown>(null)

  const load = () => {
    setError(null)
    Promise.all([fetchFullScan(), fetchInboxSignals(20)])
      .then(([scan, tvSignals]) => {
        const signals = [
          ...scan.evals.flatMap((e) => e.signals).sort((a, b) => b.confidence - a.confidence),
          ...scan.evals.flatMap((e) => e.blocked).sort((a, b) => b.confidence - a.confidence),
        ]
        setData({ signals, tvSignals })
      })
      .catch(setError)
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [])

  if (error) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <h1 className="text-xl font-semibold tracking-tight">Trade Plans</h1>
        <ErrorState error={error} retry={load} />
      </div>
    )
  }
  if (!data) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <LoadingState />
      </div>
    )
  }

  const { signals, tvSignals } = data

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Trade Plans</h1>
        <p className="text-sm text-muted-foreground">
          Every plan carries exact entry, stop, targets, and the reasoning that approved or blocked it.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          TradingView Inbox — chart detects, FlowEdge decides
        </h2>
        <TvInbox signals={tvSignals} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Internal Scanner
        </h2>
        <SignalsList signals={signals} />
      </section>
    </div>
  )
}
