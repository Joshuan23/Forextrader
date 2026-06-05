import type { Candle, Timeframe } from '@/types/forex'
import { isConfigured, fetchCandles as avFetch, fetchLiveRate as avLiveRate } from './alphavantage'
import { fetchYahooCandles, fetchYahooLiveRate } from './yahoo'
import { generateCandles, getLivePrice } from '@/lib/forex/data'
import { CURRENCY_PAIRS } from '@/lib/forex/pairs'

export async function getCandles(
  pair: string,
  timeframe: Timeframe,
  count: number
): Promise<{ candles: Candle[]; source: 'live' | 'simulated' }> {
  // 1. Yahoo Finance — free, real market data, no key needed
  const yfCandles = await fetchYahooCandles(pair, timeframe, count)
  if (yfCandles.length > 0) {
    return { candles: yfCandles, source: 'live' }
  }

  // 2. Alpha Vantage — if API key is configured
  if (isConfigured()) {
    const candles = await avFetch(pair, timeframe, count)
    if (candles.length > 0) {
      return { candles, source: 'live' }
    }
  }

  // 3. Simulation fallback
  const candles = generateCandles(pair, timeframe, count)
  return { candles, source: 'simulated' }
}

export async function getLiveRates(
  pairs: string[]
): Promise<Record<string, { bid: number; ask: number; mid: number; source: 'live' | 'simulated' }>> {
  const result: Record<string, { bid: number; ask: number; mid: number; source: 'live' | 'simulated' }> = {}

  for (const pair of pairs) {
    // 1. Yahoo Finance live rate
    const yfRate = await fetchYahooLiveRate(pair)
    if (yfRate) {
      result[pair] = { ...yfRate, source: 'live' }
      continue
    }

    // 2. Alpha Vantage if configured
    if (isConfigured()) {
      const rate = await avLiveRate(pair)
      if (rate) {
        result[pair] = { ...rate, source: 'live' }
        continue
      }
    }

    // 3. Simulation fallback
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
