import type { Candle, Timeframe } from '@/types/forex'
import { isConfigured, fetchCandles as avFetch, fetchLiveRate as avLiveRate } from './alphavantage'
import { isConfigured as tdConfigured, fetchCandles as tdFetch, fetchLiveRate as tdLiveRate } from './twelvedata'
import { isConfigured as oandaConfigured, fetchCandles as oandaFetch, fetchLiveRate as oandaLiveRate } from './oanda'
import { fetchYahooCandles, fetchYahooLiveRate } from './yahoo'
import { fetchFrankfurterRate, franklinSupports } from './frankfurter'
import { generateCandles, generateAnchoredCandles, getLivePrice } from '@/lib/forex/data'
import { CURRENCY_PAIRS } from '@/lib/forex/pairs'

// Simulated market data is a development affordance ONLY. In production
// (non-demo) the chain is Yahoo → Alpha Vantage → loud SetupError; the
// engine must never scan synthetic candles in production.
function simulationAllowed(): boolean {
  return process.env.DEVELOPMENT_DEMO_MODE === 'true' || process.env.NODE_ENV !== 'production'
}

async function failNoLiveData(pair: string): Promise<never> {
  const { SetupError } = await import('@/lib/config/runtime')
  throw new SetupError(
    `Live market data unavailable for ${pair}. Yahoo Finance is unreachable from this host and no market-data provider is configured. ` +
      'Set OANDA_API_TOKEN (free practice account, no daily cap: oanda.com), TWELVE_DATA_API_KEY (free 800 req/day: twelvedata.com), or ALPHA_VANTAGE_API_KEY — or set DEVELOPMENT_DEMO_MODE=true for simulated data.'
  )
}

export type CandleProvider = 'oanda' | 'yahoo' | 'twelvedata' | 'alphavantage' | 'frankfurter_anchored' | 'synthetic'

export async function getCandles(
  pair: string,
  timeframe: Timeframe,
  count: number
): Promise<{ candles: Candle[]; source: 'live' | 'simulated'; provider: CandleProvider }> {
  // 1. OANDA — real broker OHLCV, no daily cap (practice/live token)
  if (oandaConfigured()) {
    const candles = await oandaFetch(pair, timeframe, count)
    if (candles.length > 0) {
      return { candles, source: 'live', provider: 'oanda' }
    }
  }

  // 2. Yahoo Finance — real OHLCV (may be blocked from some cloud IPs;
  //    history depth is shallow: ~5d of 15m, ~30d of 1h)
  const yfCandles = await fetchYahooCandles(pair, timeframe, count)
  if (yfCandles.length > 0) {
    return { candles: yfCandles, source: 'live', provider: 'yahoo' }
  }

  // 3. Twelve Data — real OHLCV, cloud-friendly (free 800 req/day, 8/min)
  if (tdConfigured()) {
    const candles = await tdFetch(pair, timeframe, count)
    if (candles.length > 0) {
      return { candles, source: 'live', provider: 'twelvedata' }
    }
  }

  // 4. Alpha Vantage — if API key is configured
  if (isConfigured()) {
    const candles = await avFetch(pair, timeframe, count)
    if (candles.length > 0) {
      return { candles, source: 'live', provider: 'alphavantage' }
    }
  }

  // Real providers exhausted — simulated data only where explicitly allowed.
  if (!simulationAllowed()) await failNoLiveData(pair)

  // 5. Frankfurter-anchored simulation — synthetic candles ending at the real current price
  if (franklinSupports(pair)) {
    const realRate = await fetchFrankfurterRate(pair)
    if (realRate) {
      const candles = generateAnchoredCandles(pair, timeframe, count, realRate)
      return { candles, source: 'simulated', provider: 'frankfurter_anchored' }
    }
  }

  // 6. Pure simulation fallback
  const candles = generateCandles(pair, timeframe, count)
  return { candles, source: 'simulated', provider: 'synthetic' }
}

export async function getLiveRates(
  pairs: string[]
): Promise<Record<string, { bid: number; ask: number; mid: number; source: 'live' | 'simulated' }>> {
  const result: Record<string, { bid: number; ask: number; mid: number; source: 'live' | 'simulated' }> = {}

  for (const pair of pairs) {
    // 1. OANDA live price — real broker feed, no daily cap
    if (oandaConfigured()) {
      const oandaRate = await oandaLiveRate(pair)
      if (oandaRate) {
        result[pair] = { ...oandaRate, source: 'live' }
        continue
      }
    }

    // 2. Yahoo Finance live rate
    const yfRate = await fetchYahooLiveRate(pair)
    if (yfRate) {
      result[pair] = { ...yfRate, source: 'live' }
      continue
    }

    // 3. Twelve Data live price — real, cloud-friendly
    if (tdConfigured()) {
      const tdRate = await tdLiveRate(pair)
      if (tdRate) {
        result[pair] = { ...tdRate, source: 'live' }
        continue
      }
    }

    // 3. Frankfurter (FX pairs only, ECB-backed, fully reliable)
    if (franklinSupports(pair)) {
      const mid = await fetchFrankfurterRate(pair)
      if (mid) {
        const pairConf = CURRENCY_PAIRS.find(p => p.symbol === pair)
        const halfSpread = pairConf
          ? (pairConf.spread * pairConf.pipSize) / 2
          : mid * 0.00005
        result[pair] = { bid: mid - halfSpread, ask: mid + halfSpread, mid, source: 'live' }
        continue
      }
    }

    // 3. Alpha Vantage if configured
    if (isConfigured()) {
      const rate = await avLiveRate(pair)
      if (rate) {
        result[pair] = { ...rate, source: 'live' }
        continue
      }
    }

    // 4. Simulation fallback — demo/dev only; loud failure in production
    if (!simulationAllowed()) await failNoLiveData(pair)
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
