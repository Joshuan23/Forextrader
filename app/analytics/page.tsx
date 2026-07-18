'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { EquityChart } from '@/components/flowedge/equity-chart'
import { ExpectancyBars, MagnitudeBars } from '@/components/flowedge/stat-bars'
import {
  computeExpectancy,
  costAnalysis,
  equityCurveR,
  groupExpectancy,
  stayOutQuality,
} from '@/lib/engine/expectancy'
import { SETUP_LABELS, SESSION_LABELS, type SessionTag, type SetupType } from '@/lib/engine/types'
import { listJournalEntries } from '@/lib/store/journal'
import { cn } from '@/lib/utils'
import type { JournalRecord } from '@/lib/engine/expectancy'

interface AnalyticsData {
  entries: JournalRecord[]
  overall: any
  byPair: any[]
  bySetup: any[]
  bySession: any[]
  byGrade: any[]
  stayOut: any
  curve: any[]
  costsByPair: any[]
  costsBySession: any[]
  winRateRows: any[]
  best: any
  worst: any
  bestSession: any
  worstSession: any
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)

  useEffect(() => {
    listJournalEntries().then((entries) => {
      const overall = computeExpectancy(entries)
      const byPair = groupExpectancy(entries, (e) => e.symbol)
      const bySetup = groupExpectancy(
        entries,
        (e) => e.setupType,
        (k) => SETUP_LABELS[k as SetupType] ?? k
      )
      const bySession = groupExpectancy(
        entries,
        (e) => e.sessionTag,
        (k) => SESSION_LABELS[k as SessionTag] ?? k
      )
      const byGrade = groupExpectancy(entries, (e) => e.grade, (k) => `Grade ${k}`)
      const stayOut = stayOutQuality(entries)
      const curve = equityCurveR(entries)
      const costsByPair = costAnalysis(entries, (e) => e.symbol)
      const costsBySession = costAnalysis(entries, (e) => SESSION_LABELS[e.sessionTag])

      const winRateRows = byPair.map((g: any) => ({
        key: g.key,
        label: g.label,
        value: g.winRate,
        display: `${(g.winRate * 100).toFixed(0)}%`,
        sub: `n=${g.trades}`,
      }))

      const best = byPair[0]
      const worst = byPair[byPair.length - 1]
      const bestSession = bySession[0]
      const worstSession = bySession[bySession.length - 1]

      setData({
        entries,
        overall,
        byPair,
        bySetup,
        bySession,
        byGrade,
        stayOut,
        curve,
        costsByPair,
        costsBySession,
        winRateRows,
        best,
        worst,
        bestSession,
        worstSession,
      })
    })
  }, [])

  if (!data) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  const { overall, byPair, bySetup, bySession, byGrade, stayOut, curve, costsByPair, costsBySession, winRateRows, best, worst, bestSession, worstSession } = data

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Expectancy = (win rate × avg win) − (loss rate × avg loss). Everything here feeds the
          historical-edge adjustment in live scoring.
        </p>
      </div>

      {/* Headline strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <Headline label="Expectancy / trade" value={`${sign(overall.expectancyR)}R`} tone={overall.expectancyR >= 0 ? 'long' : 'short'} />
        <Headline label="Profit factor" value={Number.isFinite(overall.profitFactor) ? overall.profitFactor.toFixed(2) : '∞'} />
        <Headline label="Win rate" value={`${(overall.winRate * 100).toFixed(0)}%`} />
        <Headline label="Avg win / loss" value={`${overall.avgWinR.toFixed(2)} / ${overall.avgLossR.toFixed(2)}`} />
        <Headline label="Max drawdown" value={`${overall.maxDrawdownR.toFixed(1)}R`} tone="short" />
        <Headline
          label="Stay-out quality"
          value={stayOut.skipped > 0 ? `${(stayOut.quality * 100).toFixed(0)}%` : '—'}
          sub={stayOut.skipped > 0 ? `+${stayOut.savedR.toFixed(1)}R saved by skipping` : undefined}
        />
      </div>

      {/* Equity curve */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-sm">Equity Curve (cumulative R)</CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          <EquityChart points={curve} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Expectancy by Setup</CardTitle>
          </CardHeader>
          <CardContent><ExpectancyBars groups={bySetup} /></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Expectancy by Session</CardTitle>
            <CardDescription>
              {bestSession && worstSession
                ? `Best: ${bestSession.label} (${sign(bestSession.expectancyR)}R) · Worst: ${worstSession.label} (${sign(worstSession.expectancyR)}R)`
                : null}
            </CardDescription>
          </CardHeader>
          <CardContent><ExpectancyBars groups={bySession} /></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Win Rate by Pair</CardTitle>
            <CardDescription>
              {best && worst ? `Best pair: ${best.label} · Worst pair: ${worst.label}` : null}
            </CardDescription>
          </CardHeader>
          <CardContent><MagnitudeBars rows={winRateRows} /></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">A-grade vs B-grade vs C-grade</CardTitle>
            <CardDescription>Does the grading actually separate quality?</CardDescription>
          </CardHeader>
          <CardContent><ExpectancyBars groups={byGrade} /></CardContent>
        </Card>
      </div>

      {/* Cost drag */}
      <div className="grid gap-4 lg:grid-cols-2">
        <CostTable title="Spread & Slippage by Pair" rows={costsByPair} />
        <CostTable title="Spread & Slippage by Session" rows={costsBySession} />
      </div>
    </div>
  )
}

function Headline({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'long' | 'short' }) {
  return (
    <Card>
      <CardContent className="p-3.5">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={cn('font-mono text-lg font-semibold tabular-nums', tone === 'long' && 'text-long', tone === 'short' && 'text-short')}>
          {value}
        </div>
        {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  )
}

function CostTable({
  title,
  rows,
}: {
  title: string
  rows: { key: string; trades: number; avgSpreadPips: number; avgSlippagePips: number; totalCostPips: number }[]
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
        <CardDescription>Cost drag paid on executed trades</CardDescription>
      </CardHeader>
      <CardContent className="p-0 sm:p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Group</TableHead>
              <TableHead className="text-right">Trades</TableHead>
              <TableHead className="text-right">Avg spread</TableHead>
              <TableHead className="text-right">Avg slippage</TableHead>
              <TableHead className="text-right">Total cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.key}>
                <TableCell className="font-medium">{r.key}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{r.trades}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{r.avgSpreadPips.toFixed(2)}p</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{r.avgSlippagePips.toFixed(2)}p</TableCell>
                <TableCell className="text-right font-mono tabular-nums text-muted-foreground">{r.totalCostPips.toFixed(1)}p</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function sign(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}`
}
