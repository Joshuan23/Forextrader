import type { Candle, Timeframe } from '@/types/forex'
import { isConfigured, fetchCandles as avFetch, fetchLiveRate as avLiveRate } from './alphavantage'
import { generateCandles, getLivePrice } from '@/lib/forex/data'
import { CURRENCY_PAIRS } from '@/lib/forex/pairs'

export async function getCandles(
  pair: string,
  timeframe: Timeframe,
  count: number
): Promise<{ candles: Candle[]; source: 'live' | 'simulated' }> {
  if (isConfigured()) {
    const candles = await avFetch(pair, timeframe, count)
    if (candles.length > 0) {
      return { candles, source: 'live' }
    }
  }

  // Fallback to simulated data
  const candles = generateCandles(pair, timeframe, count)
  return { candles, source: 'simulated' }
}

export async function getLiveRates(
  pairs: string[]
): Promise<Record<string, { bid: number; ask: number; mid: number; source: 'live' | 'simulated' }>> {
  const result: Record<string, { bid: number; ask: number; mid: number; source: 'live' | 'simulated' }> = {}

  for (const pair of pairs) {
    if (isConfigured()) {
      const rate = await avLiveRate(pair)
      if (rate) {
        result[pair] = { ...rate, source: 'live' }
        continue
      }
    }

    // Fallback to simulated
    const livePrice = getLivePrice(pair)
    result[pair] = {
      bid: livePrice.bid,
      ask: livePrice.ask,
      mid: livePrice.mid,
      source: 'simulated',
    }
  }

  return result
}

// Re-export CURRENCY_PAIRS for convenience
export { CURRENCY_PAIRS }
