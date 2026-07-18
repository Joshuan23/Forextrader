'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ShieldAlert, Timer } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { DirectionBadge, EventRiskBadge, GradeBadge, ConfidenceMeter } from './badges'
import type { EngineSignal } from '@/lib/engine/types'
import { SETUP_LABELS } from '@/lib/engine/types'
import { cn } from '@/lib/utils'

function fmtPrice(v: number, digits: number) {
  return v.toFixed(digits)
}

function LevelCell({ label, value, digits, tone }: { label: string; value: number; digits: number; tone?: 'long' | 'short' | 'muted' }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div
        className={cn(
          'truncate font-mono text-sm font-semibold tabular-nums',
          tone === 'long' && 'text-long',
          tone === 'short' && 'text-short'
        )}
      >
        {fmtPrice(value, digits)}
      </div>
    </div>
  )
}

// The core deliverable: a full institutional trade-plan card with exact
// levels and a tap-to-expand reasoning accordion (mobile-first).
export function SignalCard({ signal, defaultOpen = false }: { signal: EngineSignal; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const blocked = signal.status === 'blocked'
  const d = signal.digits
  const p = signal.plan

  return (
    <Card className={cn(blocked && 'opacity-80')}>
      <CardContent className="p-4 sm:p-5">
        {/* Header row */}
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/pairs/${signal.symbol.replace('/', '')}`} className="text-base font-semibold tracking-tight hover:text-primary">
            {signal.symbol}
          </Link>
          <DirectionBadge direction={signal.direction} blocked={blocked} />
          <GradeBadge grade={signal.grade} />
          <span className="ml-auto">
            <ConfidenceMeter value={signal.confidence} blocked={blocked} />
          </span>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{SETUP_LABELS[signal.setupType]}</span>
          <span>·</span>
          <span>{signal.timeframe} · {signal.session.label}</span>
          <span>·</span>
          <span className="uppercase">{signal.entryType} entry</span>
          {signal.dataSource === 'simulated' && (
            <>
              <span>·</span>
              <span className="text-amber-400/80">sim data</span>
            </>
          )}
        </div>

        {/* Exact levels */}
        <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
          <LevelCell label="Entry" value={p.entry} digits={d} />
          <LevelCell label="Stop" value={p.stopLoss} digits={d} tone="short" />
          <LevelCell label="TP1" value={p.takeProfit1} digits={d} tone="long" />
          <LevelCell label="TP2" value={p.takeProfit2} digits={d} tone="long" />
          {p.takeProfit3 !== undefined ? (
            <LevelCell label="TP3" value={p.takeProfit3} digits={d} tone="long" />
          ) : (
            <div className="hidden sm:block" />
          )}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">R:R</div>
            <div className="font-mono text-sm font-semibold tabular-nums">
              {p.rrTp1.toFixed(2)} / {p.riskReward.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Conditions row */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded bg-secondary px-1.5 py-0.5 font-mono tabular-nums text-muted-foreground">
            spread {signal.execution.spreadPips.toFixed(1)}p · {signal.execution.spreadState}
          </span>
          <span className="rounded bg-secondary px-1.5 py-0.5 font-mono tabular-nums text-muted-foreground">
            ATR {signal.regime.atrPips.toFixed(1)}p
          </span>
          <EventRiskBadge level={signal.eventRisk.level} />
          <span className="ml-auto inline-flex items-center gap-1 text-muted-foreground">
            <Timer className="h-3 w-3" />
            {new Date(signal.createdAt).toISOString().slice(11, 16)}→
            {new Date(signal.expiresAt).toISOString().slice(11, 16)} UTC
          </span>
        </div>

        {blocked && (
          <div className="mt-3 rounded-md border border-border bg-muted/60 p-2.5 text-xs">
            <div className="mb-1 flex items-center gap-1.5 font-semibold text-muted-foreground">
              <ShieldAlert className="h-3.5 w-3.5" /> NO TRADE — blocked by:
            </div>
            <ul className="list-inside list-disc space-y-0.5 text-muted-foreground">
              {signal.blockReasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Reasoning accordion */}
        <button
          onClick={() => setOpen(!open)}
          className="mt-3 flex w-full items-center justify-between rounded-md py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          aria-expanded={open}
        >
          Why {blocked ? 'blocked' : 'this trade'} — layer breakdown
          <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
        </button>

        {open && (
          <div className="mt-2 space-y-3 text-xs">
            <div className="space-y-1.5">
              {signal.layerScores.map((l) => (
                <div key={l.key} className="flex items-center gap-2">
                  <span className="w-32 shrink-0 text-muted-foreground">{l.label}</span>
                  <div className="h-1.5 w-full max-w-[140px] overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-primary/70" style={{ width: `${l.score}%` }} />
                  </div>
                  <span className="w-8 shrink-0 text-right font-mono tabular-nums">{l.score}</span>
                  <span className="hidden min-w-0 truncate text-muted-foreground lg:inline" title={l.note}>
                    {l.note}
                  </span>
                </div>
              ))}
              {signal.historicalEdge && (
                <div className="text-muted-foreground">{signal.historicalEdge.note}</div>
              )}
            </div>
            <Separator />
            <p className="leading-relaxed text-muted-foreground">{signal.explanation}</p>
            <div className="rounded-md border border-border p-2.5">
              <div className="mb-1 font-semibold">Invalidation</div>
              <p className="text-muted-foreground">{p.invalidationLogic}</p>
            </div>
            <div className="rounded-md border border-border p-2.5">
              <div className="mb-1 font-semibold">Management</div>
              <p className="text-muted-foreground">{p.managementPlan}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
