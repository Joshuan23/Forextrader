'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { GradeBadge } from '@/components/flowedge/badges'
import { scanMarket } from '@/lib/engine'
import { REGIME_LABELS, type PairEvaluation } from '@/lib/engine/types'
import { getSettings } from '@/lib/store/settings'
import { listJournalEntries } from '@/lib/store/journal'
import { cn } from '@/lib/utils'

export default function PairsPage() {
  const [evals, setEvals] = useState<PairEvaluation[] | null>(null)

  useEffect(() => {
    Promise.all([getSettings(), listJournalEntries()]).then(async ([settings, journal]) => {
      const scanned = await scanMarket(settings, journal)
      setEvals(scanned)
    })
  }, [])

  if (!evals) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Pairs</h1>
        <p className="text-sm text-muted-foreground">Whitelisted instruments, ranked by opportunity.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {evals.map((e) => {
          const best = e.signals[0]
          return (
            <Link key={e.symbol} href={`/pairs/${e.symbol.replace('/', '')}`}>
              <Card className="transition-colors hover:border-primary/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">{e.symbol}</div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="font-mono text-lg tabular-nums">{e.price.toFixed(e.digits)}</span>
                    <span
                      className={cn(
                        'font-mono text-xs tabular-nums',
                        e.changePct > 0 ? 'text-long' : e.changePct < 0 ? 'text-short' : 'text-muted-foreground'
                      )}
                    >
                      {e.changePct > 0 ? '+' : ''}
                      {e.changePct.toFixed(2)}%
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{REGIME_LABELS[e.regime.tag]}</span>
                    <span>·</span>
                    <span>HTF {e.structure.htfBias}</span>
                    <span className="ml-auto">
                      {best ? <GradeBadge grade={best.grade} /> : <span className="text-muted-foreground">no trade</span>}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
