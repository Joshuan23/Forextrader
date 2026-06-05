import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { Timeframe } from '@/types/forex'
import { getCandles } from '@/lib/data/provider'

const querySchema = z.object({
  pair: z.string().min(1),
  timeframe: z.enum(['1m', '5m', '15m', '1h', '4h', '1d']),
  count: z.coerce.number().int().min(10).max(120).default(80),
})

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const parsed = querySchema.safeParse({
    pair: searchParams.get('pair'),
    timeframe: searchParams.get('timeframe'),
    count: searchParams.get('count') ?? 80,
  })

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
  }

  const { pair, timeframe, count } = parsed.data
  try {
    const { candles, source } = await getCandles(pair, timeframe as Timeframe, count)
    return NextResponse.json({ candles, source })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
