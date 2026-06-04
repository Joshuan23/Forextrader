import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { Timeframe } from '@/types/forex'
import { getCandles } from '@/lib/data/provider'
import { analyzeSMC } from '@/lib/smc'
import { fetchCOT } from '@/lib/cot/cftc'

const querySchema = z.object({
  pair: z.string().min(1),
  timeframe: z.enum(['1m', '5m', '15m', '1h', '4h', '1d']),
  count: z.coerce.number().int().min(50).max(500).default(200),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const parsed = querySchema.safeParse({
      pair: searchParams.get('pair'),
      timeframe: searchParams.get('timeframe'),
      count: searchParams.get('count') ?? 200,
    })

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { pair, timeframe, count } = parsed.data

    // Fetch candles and COT data in parallel
    const [{ candles, source: dataSource }, cotReport] = await Promise.all([
      getCandles(pair, timeframe as Timeframe, count),
      fetchCOT(pair),
    ])
    const candleCount = candles.length

    const analysis = analyzeSMC(pair, timeframe as Timeframe, candles, cotReport)

    // Strip candles array — too large to return
    const { candles: _c, ...rest } = analysis

    return NextResponse.json({
      ...rest,
      dataSource,
      candleCount,
    })
  } catch (error) {
    console.error('SMC analysis error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
