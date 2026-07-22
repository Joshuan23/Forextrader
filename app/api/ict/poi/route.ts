import { NextResponse } from 'next/server'
import { getCandles } from '@/lib/data/provider'
import { detectPois } from '@/lib/smc/poi'
import { getSettings } from '@/lib/store/settings'
import { getPairBySymbol } from '@/lib/forex/pairs'
import { errorResponse } from '@/lib/config/runtime'
import type { Timeframe } from '@/types/forex'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// GET /api/ict/poi — unmitigated Points of Interest (Order Blocks + Fair
// Value Gaps) per whitelisted pair, each as a limit-entry plan.
const TF: Timeframe = '15m'

export async function GET() {
  try {
    const settings = await getSettings()
    const pairs = await Promise.all(
      settings.pairWhitelist.map(async (symbol) => {
        const cfg = getPairBySymbol(symbol)
        try {
          const { candles } = await getCandles(symbol, TF, 400)
          if (candles.length < 60) return { symbol, status: 'insufficient_data' }
          const pip = cfg?.pipSize ?? 0.0001
          const digits = cfg?.digits ?? 5
          const round = (x: number) => Number(x.toFixed(digits))
          const pois = detectPois(candles, pip).map((p) => ({
            kind: p.kind,
            direction: p.direction,
            top: round(p.top),
            bottom: round(p.bottom),
            entry: round(p.entry),
            stopLoss: round(p.stopLoss),
            takeProfit: round(p.takeProfit),
            riskReward: p.riskReward,
            distancePips: p.distancePips,
          }))
          return { symbol, name: cfg?.name ?? symbol, lastClose: round(candles[candles.length - 1].close), pois }
        } catch (e) {
          return { symbol, status: 'error', error: e instanceof Error ? e.message : 'failed' }
        }
      })
    )
    return NextResponse.json({
      ok: true,
      scannedAt: new Date().toISOString(),
      timeframe: TF,
      note: 'Points of Interest are unmitigated Order Blocks & Fair Value Gaps — limit-entry zones price has not yet returned to. Confirm with sweep/MSS before acting.',
      pairs,
    })
  } catch (e) {
    const { body, status } = errorResponse(e)
    return NextResponse.json(body, { status })
  }
}
