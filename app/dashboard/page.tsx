import Link from 'next/link'
import { AlertTriangle, CalendarClock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { SignalCard } from '@/components/flowedge/signal-card'
import { EventRiskBadge, GradeBadge, DirectionBadge } from '@/components/flowedge/badges'
import { scanMarket, getSessionInfo, getProfile } from '@/lib/engine'
import { REGIME_LABELS, SETUP_LABELS, type PairEvaluation } from '@/lib/engine/types'
import { getSettings } from '@/lib/store/settings'
import { listJournalEntries } from '@/lib/store/journal'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
  const [settings, journal] = await Promise.all([getSettings(), listJournalEntries()])
  const evals = await scanMarket(settings, journal)
  const session = getSessionInfo()
  const profile = getProfile(settings.activeProfileId)

  const approved = evals.flatMap((e) => e.signals).sort((a, b) => b.confidence - a.confidence)
  const blocked = evals.flatMap((e) => e.blocked)
  const inBlackout = evals.filter((e) => e.eventRisk.inBlackout)
  const nextEvents = dedupeEvents(evals)

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Market Desk</h1>
          <p className="text-sm text-muted-foreground">
            Profile: {profile.name} · {approved.length} approved / {blocked.length} blocked across {evals.length} pairs
          </p>
        </div>
      </div>

      {/* Event risk banner */}
      {inBlackout.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div>
            <div className="font-semibold text-destructive">News blackout active</div>
            <div className="text-muted-foreground">
              {inBlackout.map((e) => `${e.symbol}: ${e.eventRisk.blackoutReason}`).join(' · ')}
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Session state */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Session State</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className={cn('font-semibold', session.marketOpen ? 'text-long' : 'text-muted-foreground')}>
                {session.marketOpen ? session.label : 'Market Closed'}
              </span>
              <Badge variant="secondary">{session.liquidity} liquidity</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{session.nextChange}</p>
            <SessionTimeline utcHour={session.utcHour} />
          </CardContent>
        </Card>

        {/* Regime summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Market Regime</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-xs">
            {evals.slice(0, 6).map((e) => (
              <div key={e.symbol} className="flex items-center justify-between gap-2">
                <Link href={pairHref(e.symbol)} className="font-medium hover:text-primary">
                  {e.symbol}
                </Link>
                <span className="text-muted-foreground">{REGIME_LABELS[e.regime.tag]}</span>
                <span className="font-mono tabular-nums text-muted-foreground">ADX {e.regime.adx}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Event risk */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Event Risk</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {nextEvents.length === 0 && <p className="text-muted-foreground">No high-impact events in the next 72h.</p>}
            {nextEvents.slice(0, 4).map((ev) => (
              <div key={ev.id} className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 truncate">
                  <CalendarClock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{ev.title}</span>
                </span>
                <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                  {ev.currency} · {fmtMinutes(ev.minutesTo)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Top approved signals */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Top Approved Signals
        </h2>
        {approved.length === 0 ? (
          <NoTradeCard />
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {approved.slice(0, 4).map((s) => (
              <SignalCard key={s.id} signal={s} />
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Blocked signals */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Blocked Signals</CardTitle>
            <CardDescription>Setups detected, then rejected by context filters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5 text-xs">
            {blocked.length === 0 && <p className="text-muted-foreground">Nothing blocked right now.</p>}
            {blocked.slice(0, 6).map((s) => (
              <div key={s.id} className="rounded-md border p-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{s.symbol}</span>
                  <DirectionBadge direction={s.direction} blocked />
                  <span className="text-muted-foreground">{SETUP_LABELS[s.setupType]}</span>
                  <span className="ml-auto font-mono text-muted-foreground">{s.confidence}</span>
                </div>
                <p className="mt-1 text-muted-foreground">{s.blockReasons[0]}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Pair ranking board */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Pair Ranking</CardTitle>
            <CardDescription>Opportunity score across the whitelist</CardDescription>
          </CardHeader>
          <CardContent className="p-0 sm:p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pair</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">24h</TableHead>
                  <TableHead>Best</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {evals.map((e) => {
                  const best = e.signals[0]
                  return (
                    <TableRow key={e.symbol}>
                      <TableCell>
                        <Link href={pairHref(e.symbol)} className="font-medium hover:text-primary">
                          {e.symbol}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {e.price.toFixed(e.digits)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          'text-right font-mono tabular-nums',
                          e.changePct > 0 ? 'text-long' : e.changePct < 0 ? 'text-short' : 'text-muted-foreground'
                        )}
                      >
                        {e.changePct > 0 ? '+' : ''}
                        {e.changePct.toFixed(2)}%
                      </TableCell>
                      <TableCell className="text-xs">
                        {best ? <GradeBadge grade={best.grade} /> : <span className="text-muted-foreground">no trade</span>}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{e.rankScore}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function NoTradeCard() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-1.5 py-8 text-center">
        <div className="text-base font-semibold">NO TRADE</div>
        <p className="max-w-md text-sm text-muted-foreground">
          No setup currently clears every contextual filter. Standing aside is a position — the
          engine will surface the next qualified plan when structure, session, and execution align.
        </p>
      </CardContent>
    </Card>
  )
}

// Horizontal 24h UTC strip showing session windows and current time.
function SessionTimeline({ utcHour }: { utcHour: number }) {
  const rows = [
    { name: 'Asia', start: 23, end: 8 },
    { name: 'London', start: 7, end: 16 },
    { name: 'NY', start: 12, end: 21 },
  ]
  return (
    <div className="space-y-1 pt-1">
      {rows.map((r) => (
        <div key={r.name} className="flex items-center gap-2">
          <span className="w-10 text-[10px] uppercase tracking-wider text-muted-foreground">{r.name}</span>
          <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-secondary">
            {r.start < r.end ? (
              <div
                className="absolute h-full rounded-full bg-primary/30"
                style={{ left: pct(r.start), width: pct(r.end - r.start) }}
              />
            ) : (
              <>
                <div className="absolute h-full bg-primary/30" style={{ left: pct(r.start), width: pct(24 - r.start) }} />
                <div className="absolute h-full bg-primary/30" style={{ left: 0, width: pct(r.end) }} />
              </>
            )}
            <div className="absolute top-0 h-full w-0.5 bg-foreground" style={{ left: pct(utcHour) }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function pct(h: number) {
  return `${(h / 24) * 100}%`
}

function pairHref(symbol: string) {
  return `/pairs/${symbol.replace('/', '')}`
}

function fmtMinutes(mins: number) {
  if (mins >= 60 * 24) return `${Math.round(mins / (60 * 24))}d`
  if (mins >= 60) return `${Math.floor(mins / 60)}h${mins % 60 > 0 ? ` ${mins % 60}m` : ''}`
  return `${mins}m`
}

function dedupeEvents(evals: PairEvaluation[]) {
  const seen = new Map<string, { id: string; title: string; currency: string; minutesTo: number }>()
  for (const e of evals) {
    const ev = e.eventRisk.nextHighImpact
    if (ev && !seen.has(ev.id)) seen.set(ev.id, ev)
  }
  return [...seen.values()].sort((a, b) => a.minutesTo - b.minutesTo)
}
