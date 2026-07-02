import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { Timeframe } from '@/types/forex'
import { getCandles, getLiveRates } from '@/lib/data/provider'

const querySchema = z.object({
  pair:      z.string().min(1),
  timeframe: z.enum(['1m', '5m', '15m', '1h', '4h', '1d']),
  count:     z.coerce.number().int().min(10).max(500).default(200),
})

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const parsed = querySchema.safeParse({
    pair:      searchParams.get('pair') ?? 'EUR/USD',
    timeframe: searchParams.get('timeframe') ?? '1h',
    count:     searchParams.get('count') ?? 200,
  })

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
  }

  const { pair, timeframe, count } = parsed.data

  try {
    const [{ candles, source }, rates] = await Promise.all([
      getCandles(pair, timeframe as Timeframe, count),
      getLiveRates([pair]),
    ])

    const rate = rates[pair]
    const lastCandle = candles[candles.length - 1]

    const livePrice = rate
      ? {
          pair,
          bid:    rate.bid,
          ask:    rate.ask,
          mid:    rate.mid,
          change: lastCandle
            ? parseFloat((((rate.mid - lastCandle.open) / lastCandle.open) * 100).toFixed(3))
            : 0,
          changeAbs: lastCandle
            ? parseFloat((rate.mid - lastCandle.open).toFixed(5))
            : 0,
          high:   lastCandle ? Math.max(...candles.slice(-24).map(c => c.high)) : rate.mid,
          low:    lastCandle ? Math.min(...candles.slice(-24).map(c => c.low))  : rate.mid,
          time:   Date.now(),
          source: rate.source,
        }
      : null

    return NextResponse.json({ candles, livePrice, source })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
