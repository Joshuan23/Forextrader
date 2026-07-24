import { NextResponse } from 'next/server'
import { getCandles } from '@/lib/data/provider'
import { analyzeExtremePoi } from '@/lib/smc/poi-strategy'
import { getSettings } from '@/lib/store/settings'
import { getPairBySymbol } from '@/lib/forex/pairs'
import { errorResponse } from '@/lib/config/runtime'
import type { Timeframe } from '@/types/forex'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// GET /api/ict/strategy — the Extreme POI Mitigation play per whitelisted
// pair: sweep → displacement POI → mitigation entry → opposing liquidity.
const TF: Timeframe = '15m'

export async function GET() {
  try {
    const settings = await getSettings()
    const pairs = await Promise.all(
      settings.pairWhitelist.map(async (symbol) => {
        const cfg = getPairBySymbol(symbol)
        try {
          const { candles } = await getCandles(symbol, TF, 400)
          if (candles.length < 60) return { symbol, name: cfg?.name ?? symbol, status: 'insufficient_data' }
          const pip = cfg?.pipSize ?? 0.0001
          const digits = cfg?.digits ?? 5
          const round = (x: number) => Number(x.toFixed(digits))
          const s = analyzeExtremePoi(candles, pip)
          const plan = s.plan
            ? {
                bias: s.plan.bias,
                direction: s.plan.direction,
                sweepType: s.plan.sweepType,
                sweepLevel: round(s.plan.sweepLevel),
                poiTop: round(s.plan.poiTop),
                poiBottom: round(s.plan.poiBottom),
                state: s.plan.state,
                entry: round(s.plan.entry),
                stopLoss: round(s.plan.stopLoss),
                takeProfit: round(s.plan.takeProfit),
                riskReward: s.plan.riskReward,
                targetIsLiquidity: s.plan.targetIsLiquidity,
                distancePips: s.plan.distancePips,
              }
            : null
          return { symbol, name: cfg?.name ?? symbol, lastClose: round(s.lastClose), plan, reason: s.reason }
        } catch (e) {
          return { symbol, name: cfg?.name ?? symbol, status: 'error', error: e instanceof Error ? e.message : 'failed' }
        }
      })
    )
    return NextResponse.json({
      ok: true,
      scannedAt: new Date().toISOString(),
      timeframe: TF,
      note: 'Extreme POI Mitigation: a liquidity sweep leaves a supply/demand Order Block; enter on the return (mitigation) into that POI, stop beyond it, target the opposing liquidity ($$$). Wait for price to reach the POI — do not chase.',
      pairs,
    })
  } catch (e) {
    const { body, status } = errorResponse(e)
    return NextResponse.json(body, { status })
  }
}
