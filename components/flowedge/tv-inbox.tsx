'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Radio } from 'lucide-react'
import { SignalCard } from './signal-card'
import { Button } from '@/components/ui/button'
import type { EngineSignal, SignalLifecycle } from '@/lib/engine/types'
import { cn } from '@/lib/utils'

const OUTCOMES: { value: SignalLifecycle; label: string }[] = [
  { value: 'hit_tp1', label: 'TP1' },
  { value: 'hit_tp2', label: 'TP2' },
  { value: 'stopped', label: 'Stopped' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'expired', label: 'Expired' },
]

// Signals ingested from the TradingView webhook, with lifecycle controls.
export function TvInbox({ signals }: { signals: EngineSignal[] }) {
  const router = useRouter()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  async function resolve(id: string, outcome: SignalLifecycle) {
    setPendingId(id)
    setError(null)
    try {
      const res = await fetch(`/api/signals/${encodeURIComponent(id)}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcome }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? `HTTP ${res.status}`)
      }
      startTransition(() => router.refresh())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'resolve failed')
    } finally {
      setPendingId(null)
    }
  }

  if (signals.length === 0) {
    return (
      <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
        <Radio className="mx-auto mb-2 h-4 w-4" />
        No TradingView alerts received yet. Point a webhook alert from the FlowEdge Signal Feeder
        at <code className="font-mono">/api/webhooks/tradingview</code> — see docs/tradingview-integration.md.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="grid gap-3 xl:grid-cols-2">
        {signals.map((s) => (
          <div key={s.id} className="space-y-1.5">
            <SignalCard signal={s} />
            {s.status === 'approved' && (
              <div className="flex flex-wrap items-center gap-1.5 px-1">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Resolve:</span>
                {OUTCOMES.map((o) => (
                  <Button
                    key={o.value}
                    variant="outline"
                    size="sm"
                    className={cn('h-6 px-2 text-[11px]', s.lifecycle === o.value && 'border-primary text-primary')}
                    disabled={pendingId === s.id}
                    onClick={() => resolve(s.id, o.value)}
                  >
                    {o.label}
                  </Button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
