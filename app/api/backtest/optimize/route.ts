import { NextRequest, NextResponse } from 'next/server'
import { getCandles } from '@/lib/data/provider'
import { runIctBacktest, bucketStats, type IctBacktestOptions, type BacktestTrade } from '@/lib/backtest/ict'
import { getPairBySymbol } from '@/lib/forex/pairs'
import { getSettings } from '@/lib/store/settings'
import { errorResponse } from '@/lib/config/runtime'
import type { Candle, Timeframe } from '@/types/forex'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// GET /api/backtest/optimize — server-side parameter sweep. Fetches candles
// once per pair, runs every config combination in memory, and returns the
// configs ranked by TOTAL RETURN (sum of R across all trades), so you get
// the single best setting without hand-testing URLs.
//
//   ?pair=all (default, aggregates the whitelist) | EUR/USD
//   &timeframe=15m  &bars=5000  &minTrades=20  &key=CRON_SECRET

const TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1d']

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return process.env.NODE_ENV !== 'production'
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${secret}` || req.nextUrl.searchParams.get('key') === secret
}

// The search grid — deliberately small and sensible (2R is included).
function grid(): Partial<IctBacktestOptions>[] {
  const out: Partial<IctBacktestOptions>[] = []
  for (const session of ['london', 'both'] as const)
    for (const partialTp of [false, true])
      for (const minConfl of [2, 3])
        for (const minRr of [1.5, 2, 3])
          for (const maxHoldBars of [48, 96])
            out.push({ session, partialTp, minConfl, minRr, maxHoldBars, requireFvg: true, useHtfBias: true, killOnly: true })
  return out
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  const q = req.nextUrl.searchParams
  const timeframe = (q.get('timeframe') ?? '15m') as Timeframe
  if (!TIMEFRAMES.includes(timeframe)) {
    return NextResponse.json({ ok: false, error: `timeframe must be one of ${TIMEFRAMES.join(', ')}` }, { status: 422 })
  }
  const bars = Math.min(Math.max(Number(q.get('bars') ?? 5000) || 5000, 500), 5000)
  const minTrades = Math.max(1, Number(q.get('minTrades') ?? 20) || 20)

  try {
    const settings = await getSettings()
    const pairArg = q.get('pair') ?? 'all'
    const symbols = pairArg === 'all' ? settings.pairWhitelist : [pairArg]

    // Fetch candles ONCE per pair (reused across every config). Costs (NET
    // results) default on; ?costs=0 disables. Spread is per-pair in price units.
    const applyCosts = (q.get('costs') ?? '1') !== '0' && (q.get('costs') ?? 'true') !== 'false'
    const data: { symbol: string; candles: Candle[]; provider: string; spreadPrice: number }[] = []
    for (const symbol of symbols) {
      const { candles, provider } = await getCandles(symbol, timeframe, bars)
      const cfg = getPairBySymbol(symbol)
      const spreadPrice = applyCosts ? (cfg?.spread ?? 0.5) * (cfg?.pipSize ?? 0.0001) : 0
      if (candles.length >= 200) data.push({ symbol, candles, provider, spreadPrice })
    }
    if (data.length === 0) {
      return NextResponse.json({ ok: false, error: 'no pairs returned enough candles to optimize' }, { status: 422 })
    }

    const configs = grid()
    const ranked = configs
      .map((cfg) => {
        const trades: BacktestTrade[] = []
        for (const d of data) trades.push(...runIctBacktest(d.candles, { ...cfg, spreadPrice: d.spreadPrice }).trades)
        const stats = bucketStats(trades)
        const totalR = Math.round(stats.expectancyR * stats.trades * 100) / 100
        return {
          config: {
            session: cfg.session,
            partialTp: cfg.partialTp,
            minConfl: cfg.minConfl,
            minRr: cfg.minRr,
            maxHoldBars: cfg.maxHoldBars,
          },
          trades: stats.trades,
          winRate: Math.round(stats.winRate * 1000) / 10, // %
          expectancyR: Math.round(stats.expectancyR * 1000) / 1000,
          totalR,
          profitFactor: Math.round(stats.profitFactor * 100) / 100,
        }
      })
      .filter((r) => r.trades >= minTrades)
      .sort((a, b) => b.totalR - a.totalR)

    return NextResponse.json({
      ok: true,
      pairs: data.map((d) => d.symbol),
      provider: data[0]?.provider,
      timeframe,
      barsPerPair: bars,
      minTrades,
      combosTested: configs.length,
      costsApplied: applyCosts,
      note: 'NET of per-pair spread cost. Ranked by TOTAL RETURN (sum of R across all trades). Configs under minTrades are excluded as too noisy. Past performance does not guarantee future results.',
      best: ranked[0] ?? null,
      leaderboard: ranked.slice(0, 10),
    })
  } catch (e) {
    const { body, status } = errorResponse(e)
    return NextResponse.json(body, { status })
  }
}
