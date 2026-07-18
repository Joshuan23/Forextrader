'use client'

import { useEffect, useState } from 'react'
import { SignalsList } from '@/components/flowedge/signals-list'
import { TvInbox } from '@/components/flowedge/tv-inbox'
import { scanMarket } from '@/lib/engine'
import { getSettings } from '@/lib/store/settings'
import { listJournalEntries } from '@/lib/store/journal'
import { listStoredSignals } from '@/lib/store/signals'
import type { EngineSignal } from '@/lib/engine/types'

export default function SignalsPage() {
  const [data, setData] = useState<{
    signals: EngineSignal[]
    tvSignals: EngineSignal[]
  } | null>(null)

  useEffect(() => {
    Promise.all([getSettings(), listJournalEntries(), listStoredSignals(20)]).then(async ([settings, journal, tvSignals]) => {
      const evals = await scanMarket(settings, journal)
      const signals = [
        ...evals.flatMap((e) => e.signals).sort((a, b) => b.confidence - a.confidence),
        ...evals.flatMap((e) => e.blocked).sort((a, b) => b.confidence - a.confidence),
      ]
      setData({ signals, tvSignals })
    })
  }, [])

  if (!data) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="text-muted-foreground">Loading...</div>
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
