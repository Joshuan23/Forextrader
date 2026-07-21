import { NextRequest, NextResponse } from 'next/server'
import { getCandles } from '@/lib/data/provider'
import { runIctBacktest, DEFAULT_ICT_OPTIONS } from '@/lib/backtest/ict'
import { errorResponse } from '@/lib/config/runtime'
import type { Timeframe } from '@/types/forex'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// GET /api/backtest — replay the ICT feeder strategy over historical
// candles and report win-rate / expectancy / profit factor per confluence
// level. Same auth as the cron scan (CRON_SECRET) since it is compute-heavy.
//
//   ?pair=EUR/USD  &timeframe=15m  &bars=5000
//   &minConfl=3  &requireFvg=1  &useHtfBias=1  &killOnly=1
//   &minRr=2  &pivotLen=5  &cooldown=20  &maxHoldBars=96
//   &trades=1  (include the individual trade list; summary-only otherwise)

const TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1d']

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return process.env.NODE_ENV !== 'production'
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${secret}` || req.nextUrl.searchParams.get('key') === secret
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  const q = req.nextUrl.searchParams
  const pair = q.get('pair') ?? 'EUR/USD'
  const timeframe = (q.get('timeframe') ?? '15m') as Timeframe
  if (!TIMEFRAMES.includes(timeframe)) {
    return NextResponse.json({ ok: false, error: `timeframe must be one of ${TIMEFRAMES.join(', ')}` }, { status: 422 })
  }
  const bars = Math.min(Math.max(Number(q.get('bars') ?? 5000) || 5000, 200), 5000)

  const num = (name: string, dflt: number) => {
    const v = Number(q.get(name))
    return Number.isFinite(v) && v > 0 ? v : dflt
  }
  const bool = (name: string, dflt: boolean) => {
    const v = q.get(name)
    return v === null ? dflt : v === '1' || v === 'true'
  }

  try {
    const { candles, source } = await getCandles(pair, timeframe, bars)
    if (candles.length < 100) {
      return NextResponse.json(
        { ok: false, error: `Only ${candles.length} candles available for ${pair} ${timeframe} — not enough to backtest` },
        { status: 422 }
      )
    }
    const result = runIctBacktest(candles, {
      pivotLen: num('pivotLen', DEFAULT_ICT_OPTIONS.pivotLen),
      minRr: num('minRr', DEFAULT_ICT_OPTIONS.minRr),
      cooldown: num('cooldown', DEFAULT_ICT_OPTIONS.cooldown),
      maxHoldBars: num('maxHoldBars', DEFAULT_ICT_OPTIONS.maxHoldBars),
      minConfl: Math.min(5, Math.max(1, num('minConfl', DEFAULT_ICT_OPTIONS.minConfl))),
      requireFvg: bool('requireFvg', DEFAULT_ICT_OPTIONS.requireFvg),
      useHtfBias: bool('useHtfBias', DEFAULT_ICT_OPTIONS.useHtfBias),
      killOnly: bool('killOnly', DEFAULT_ICT_OPTIONS.killOnly),
    })

    const includeTrades = bool('trades', false)
    return NextResponse.json({
      ok: true,
      pair,
      timeframe,
      dataSource: source,
      from: new Date(result.firstBarTime).toISOString(),
      to: new Date(result.lastBarTime).toISOString(),
      bars: result.bars,
      options: result.options,
      overall: result.overall,
      byConfluence: result.byConfluence,
      bySession: result.bySession,
      maxDrawdownR: result.maxDrawdownR,
      note: 'Conservative fills: when a bar spans both stop and target, the stop wins. Past performance does not guarantee future results.',
      trades: includeTrades ? result.trades : undefined,
      tradeCount: result.trades.length,
    })
  } catch (e) {
    const { body, status } = errorResponse(e)
    return NextResponse.json(body, { status })
  }
}
