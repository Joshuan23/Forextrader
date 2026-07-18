import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, RefreshCcw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SignalCard } from '@/components/flowedge/signal-card'
import { EventRiskBadge } from '@/components/flowedge/badges'
import { StructureChart, type ChartLevel } from '@/components/flowedge/structure-chart'
import { createScanContext, evaluatePair } from '@/lib/engine'
import { REGIME_LABELS } from '@/lib/engine/types'
import { CURRENCY_PAIRS } from '@/lib/forex/pairs'
import { getSettings } from '@/lib/store/settings'
import { listJournalEntries } from '@/lib/store/journal'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function PairDetailPage({ params }: { params: { symbol: string } }) {
  const symbol = CURRENCY_PAIRS.find(
    (p) => p.symbol.replace('/', '').toUpperCase() === params.symbol.toUpperCase()
  )?.symbol
  if (!symbol) notFound()

  const [settings, journal] = await Promise.all([getSettings(), listJournalEntries()])
  const ctx = await createScanContext(settings, journal)
  const ev = await evaluatePair(symbol, ctx)
  if (!ev) notFound()

  const best = ev.signals[0] ?? ev.blocked[0]
  const planLevels: ChartLevel[] = best
    ? [
        { price: best.plan.entry, label: 'Entry', kind: 'entry' },
        { price: best.plan.stopLoss, label: 'SL', kind: 'stop' },
        { price: best.plan.takeProfit1, label: 'TP1', kind: 'target' },
        { price: best.plan.takeProfit2, label: 'TP2', kind: 'target' },
      ]
    : []
  // Cluster-dedupe structural levels so chart labels never overlap: skip any
  // level within 0.4×ATR of one already plotted (incl. the plan's levels).
  const minGap = ev.regime.atr * 0.4 || ev.price * 0.0004
  const plotted = planLevels.map((l) => l.price)
  const structureLevels: ChartLevel[] = []
  for (const l of ev.structure.keyLevels.filter((k) => !k.swept)) {
    if (plotted.some((p) => Math.abs(p - l.price) < minGap)) continue
    structureLevels.push({ price: l.price, label: l.type.replace(/_/g, ' '), kind: 'level' })
    plotted.push(l.price)
    if (structureLevels.length >= 3) break
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/pairs" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">{symbol}</h1>
        <span className="font-mono text-lg tabular-nums">{ev.price.toFixed(ev.digits)}</span>
        <span
          className={cn(
            'font-mono text-sm tabular-nums',
            ev.changePct > 0 ? 'text-long' : ev.changePct < 0 ? 'text-short' : 'text-muted-foreground'
          )}
        >
          {ev.changePct > 0 ? '+' : ''}
          {ev.changePct.toFixed(2)}%
        </span>
        <Badge variant="secondary" className="capitalize">{ev.dataSource} data</Badge>
        <Button asChild variant="outline" size="sm" className="ml-auto">
          <Link href={`/pairs/${params.symbol}`}>
            <RefreshCcw className="h-3.5 w-3.5" /> Re-evaluate
          </Link>
        </Button>
      </div>

      {/* Structure map */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-sm">Structure Map — {best ? 'active plan levels' : 'key levels'} (15m closes)</CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          <StructureChart candles={ev.candles} digits={ev.digits} levels={[...planLevels, ...structureLevels]} />
        </CardContent>
      </Card>

      {/* Context grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <ContextCard title="HTF Bias">
          <div className={cn('text-sm font-semibold capitalize',
            ev.structure.htfBias === 'bullish' ? 'text-long' : ev.structure.htfBias === 'bearish' ? 'text-short' : '')}>
            {ev.structure.htfBias}
          </div>
          <p className="text-xs text-muted-foreground">{ev.structure.htfNotes[0]}</p>
        </ContextCard>
        <ContextCard title="Volatility">
          <div className="text-sm font-semibold">{REGIME_LABELS[ev.regime.tag]}</div>
          <p className="text-xs text-muted-foreground">
            ATR {ev.regime.atrPips.toFixed(1)}p (P{ev.regime.atrPercentile}) · ADX {ev.regime.adx}
          </p>
        </ContextCard>
        <ContextCard title="Spread">
          <div className={cn('text-sm font-semibold capitalize', ev.execution.spreadState === 'wide' && 'text-amber-400')}>
            {ev.execution.spreadState}
          </div>
          <p className="text-xs text-muted-foreground">
            {ev.execution.spreadPips.toFixed(1)}p live · limit {ev.execution.maxAllowedSpreadPips.toFixed(1)}p
          </p>
        </ContextCard>
        <ContextCard title="News Risk">
          <EventRiskBadge level={ev.eventRisk.level} />
          <p className="mt-1 text-xs text-muted-foreground">
            {ev.eventRisk.nextHighImpact
              ? `${ev.eventRisk.nextHighImpact.title} in ${Math.floor(ev.eventRisk.nextHighImpact.minutesTo / 60)}h ${ev.eventRisk.nextHighImpact.minutesTo % 60}m`
              : 'No high-impact events ahead'}
          </p>
        </ContextCard>
        <ContextCard title="Slippage Profile">
          <div className="text-sm font-semibold">{ev.execution.slippage.avgPips.toFixed(2)}p avg</div>
          <p className="text-xs text-muted-foreground">
            worst {ev.execution.slippage.worstPips.toFixed(2)}p · fill {(ev.execution.slippage.fillQuality * 100).toFixed(0)}% · n={ev.execution.slippage.sampleSize}
          </p>
        </ContextCard>
      </div>

      {/* Trade plans */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Trade Plan Generator — approved setups
        </h2>
        {ev.signals.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              NO TRADE on {symbol} right now — no setup clears the contextual filters.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {ev.signals.map((s) => (
              <SignalCard key={s.id} signal={s} defaultOpen />
            ))}
          </div>
        )}
      </section>

      {ev.blocked.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Blocked setups
          </h2>
          <div className="grid gap-3 xl:grid-cols-2">
            {ev.blocked.map((s) => (
              <SignalCard key={s.id} signal={s} />
            ))}
          </div>
        </section>
      )}

      {/* Recent structure events */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Recent Structure Events</CardTitle>
          <CardDescription>Breaks and liquidity sweeps on the signal timeframe</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1.5 text-xs">
          {ev.structure.recentBreaks.slice(-3).reverse().map((b, i) => (
            <div key={`b-${i}`} className="flex items-center gap-2">
              <Badge variant={b.direction === 'bullish' ? 'long' : 'short'}>{b.type}</Badge>
              <span className="text-muted-foreground">
                {b.direction} through {b.brokenLevel.toFixed(ev.digits)} at {new Date(b.time).toISOString().slice(5, 16).replace('T', ' ')} UTC
              </span>
            </div>
          ))}
          {ev.structure.recentSweeps.slice(0, 3).map((s, i) => (
            <div key={`s-${i}`} className="flex items-center gap-2">
              <Badge variant="warn">{s.type === 'high_sweep' ? 'Buy-side sweep' : 'Sell-side sweep'}</Badge>
              <span className="text-muted-foreground">
                {s.pipsSwept.toFixed(1)}p through {s.level.price.toFixed(ev.digits)} · {s.reversed ? 'reversed' : 'no reversal'}
              </span>
            </div>
          ))}
          {ev.structure.recentBreaks.length === 0 && ev.structure.recentSweeps.length === 0 && (
            <p className="text-muted-foreground">No notable structure events in the window.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ContextCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-3.5">
        <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">{title}</div>
        {children}
      </CardContent>
    </Card>
  )
}
