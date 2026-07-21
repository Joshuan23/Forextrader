import { NextResponse } from 'next/server'
import { getCandles } from '@/lib/data/provider'
import { analyzeIctState } from '@/lib/backtest/ict'
import { getSettings } from '@/lib/store/settings'
import { getPairBySymbol } from '@/lib/forex/pairs'
import { errorResponse } from '@/lib/config/runtime'
import type { Timeframe } from '@/types/forex'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// GET /api/ict/watch — live ICT state for EVERY whitelisted pair: what the
// sweep→MSS→confluence strategy is currently waiting for, per pair. Same
// code path as the scanner and backtester, so this is the honest live read.
const TF: Timeframe = '15m'

const CONFLUENCE_LABEL: Record<string, string> = {
  fvg: 'Fair Value Gap',
  htf: 'HTF bias aligned',
  displacement: 'Displacement',
  rsi: 'RSI momentum',
  discount: 'Price in discount',
  premium: 'Price in premium',
}

export async function GET() {
  try {
    const settings = await getSettings()
    const pairs = await Promise.all(
      settings.pairWhitelist.map(async (symbol) => {
        const cfg = getPairBySymbol(symbol)
        try {
          const { candles, provider } = await getCandles(symbol, TF, 400)
          if (candles.length < 250) {
            return { symbol, status: 'insufficient_data', bars: candles.length }
          }
          const s = analyzeIctState(candles)
          const digits = cfg?.digits ?? 5
          const pip = cfg?.pipSize ?? 0.0001
          const fmt = (n: number | null) => (n === null ? null : Number(n.toFixed(digits)))
          const pipsTo = (target: number | null) =>
            target === null ? null : Math.round((Math.abs(target - s.lastClose) / pip) * 10) / 10

          // Plain-English "what are we waiting for"
          let waitingFor: string
          if (s.bias === 'neutral') {
            waitingFor = `No liquidity swept yet — waiting for price to run a swing high or low and reject back inside.`
          } else if (s.bias === 'armed_long') {
            const d = pipsTo(s.mssTarget)
            waitingFor = s.mssBroken
              ? `Sell-side liquidity swept at ${fmt(s.sweepLevel)} and structure already broken — entry window closing.`
              : `Sell-side liquidity swept at ${fmt(s.sweepLevel)}. Waiting for a 15m close ABOVE ${fmt(s.mssTarget)} (${d} pips away) to confirm the long.`
          } else {
            const d = pipsTo(s.mssTarget)
            waitingFor = s.mssBroken
              ? `Buy-side liquidity swept at ${fmt(s.sweepLevel)} and structure broken — window closing.`
              : `Buy-side liquidity swept at ${fmt(s.sweepLevel)}. Waiting for a 15m close BELOW ${fmt(s.mssTarget)} (${d} pips away) to confirm the short.`
          }

          return {
            symbol,
            name: cfg?.name ?? symbol,
            provider,
            bias: s.bias, // armed_long | armed_short | neutral
            lastClose: fmt(s.lastClose),
            htfBias: s.htfBias, // up | down | neutral
            killZone: s.killZone, // london | newyork | off
            inKillZone: s.inKillZone,
            sweepLevel: fmt(s.sweepLevel),
            mssTarget: fmt(s.mssTarget),
            pipsToTarget: pipsTo(s.mssTarget),
            confluencesReady: s.confirmationsReady.map((c) => CONFLUENCE_LABEL[c] ?? c),
            confluenceScore: s.confluenceScore,
            waitingFor,
          }
        } catch (e) {
          return { symbol, status: 'error', error: e instanceof Error ? e.message : 'analysis failed' }
        }
      })
    )

    return NextResponse.json({
      ok: true,
      scannedAt: new Date().toISOString(),
      timeframe: TF,
      note: 'Kill zones (UTC): London 07:00–10:00, New York 12:00–15:00. Entries only fire inside a kill zone.',
      pairs,
    })
  } catch (e) {
    const { body, status } = errorResponse(e)
    return NextResponse.json(body, { status })
  }
}
