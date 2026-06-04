import { NextRequest, NextResponse } from 'next/server'
import { generateCandles } from '@/lib/forex/data'
import { getLivePrice } from '@/lib/forex/data'
import { Timeframe } from '@/types/forex'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const pair = searchParams.get('pair') ?? 'EUR/USD'
  const timeframe = (searchParams.get('timeframe') ?? '1h') as Timeframe
  const count = parseInt(searchParams.get('count') ?? '200', 10)

  const candles = generateCandles(pair, timeframe, count)
  const livePrice = getLivePrice(pair)

  return NextResponse.json({ candles, livePrice })
}
