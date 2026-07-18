/**
 * Yahoo Finance data fetcher — free, no API key required.
 * Covers all forex pairs (EURUSD=X style), metals (GC=F, SI=F),
 * and indices (^NDX, ^GSPC) with real OHLCV history.
 */

import type { Candle, Timeframe } from '@/types/forex'

const TICKER: Record<string, string> = {
  'EUR/USD': 'EURUSD=X',
  'GBP/USD': 'GBPUSD=X',
  'USD/JPY': 'USDJPY=X',
  'USD/CHF': 'USDCHF=X',
  'AUD/USD': 'AUDUSD=X',
  'USD/CAD': 'USDCAD=X',
  'NZD/USD': 'NZDUSD=X',
  'EUR/GBP': 'EURGBP=X',
  'XAU/USD': 'GC=F',
  'XAG/USD': 'SI=F',
  'NAS100':  '^NDX',
  'US500':   '^GSPC',
}

interface YfParams { interval: string; range: string }

function yfParams(tf: Timeframe): YfParams {
  switch (tf) {
    case '1m':  return { interval: '1m',  range: '1d'  }
    case '5m':  return { interval: '5m',  range: '5d'  }
    case '15m': return { interval: '15m', range: '5d'  }
    case '1h':  return { interval: '60m', range: '30d' }
    case '4h':  return { interval: '60m', range: '60d' } // resample 1h→4h
    case '1d':  return { interval: '1d',  range: '2y'  }
    default:    return { interval: '60m', range: '30d' }
  }
}

function resample4h(candles: Candle[]): Candle[] {
  const out: Candle[] = []
  for (let i = 0; i < candles.length; i += 4) {
    const g = candles.slice(i, i + 4)
    if (g.length === 0) continue
    out.push({
      time:   g[0].time,
      open:   g[0].open,
      high:   Math.max(...g.map(c => c.high)),
      low:    Math.min(...g.map(c => c.low)),
      close:  g[g.length - 1].close,
      volume: g.reduce((s, c) => s + (c.volume ?? 0), 0),
    })
  }
  return out
}

async function yfFetch(ticker: string, params: YfParams): Promise<Response> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${params.interval}&range=${params.range}&includePrePost=false`
  return fetch(url, {
    headers: {
      'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept':          'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Origin':          'https://finance.yahoo.com',
      'Referer':         'https://finance.yahoo.com/',
    },
    next: { revalidate: 60 },
    signal: AbortSignal.timeout(5000),
  })
}

export async function fetchYahooCandles(
  pair: string,
  timeframe: Timeframe,
  count: number,
): Promise<Candle[]> {
  const ticker = TICKER[pair]
  if (!ticker) return []

  try {
    const res = await yfFetch(ticker, yfParams(timeframe))
    if (!res.ok) return []

    const json = await res.json()
    const result = json?.chart?.result?.[0]
    if (!result) return []

    const timestamps: number[] = result.timestamp ?? []
    const q = result.indicators?.quote?.[0] ?? {}
    const opens  = q.open   as (number | null)[]
    const highs  = q.high   as (number | null)[]
    const lows   = q.low    as (number | null)[]
    const closes = q.close  as (number | null)[]
    const vols   = q.volume as (number | null)[]

    const candles: Candle[] = []
    for (let i = 0; i < timestamps.length; i++) {
      const o = opens[i], h = highs[i], l = lows[i], c = closes[i]
      if (o == null || h == null || l == null || c == null) continue
      if (!isFinite(o) || !isFinite(h) || !isFinite(l) || !isFinite(c)) continue
      candles.push({
        time:   timestamps[i] * 1000,
        open:   o,
        high:   h,
        low:    l,
        close:  c,
        volume: vols?.[i] ?? 0,
      })
    }

    let result2 = timeframe === '4h' ? resample4h(candles) : candles
    return result2.slice(-count)
  } catch {
    return []
  }
}

export async function fetchYahooLiveRate(
  pair: string,
): Promise<{ bid: number; ask: number; mid: number } | null> {
  const ticker = TICKER[pair]
  if (!ticker) return null

  try {
    const res = await yfFetch(ticker, { interval: '1m', range: '1d' })
    if (!res.ok) return null

    const json = await res.json()
    const meta = json?.chart?.result?.[0]?.meta
    const mid: number = meta?.regularMarketPrice
    if (!mid || !isFinite(mid)) return null

    // Derive a minimal spread (0.01% of mid — tighter than broker spread, but realistic for mid price)
    const halfSpread = mid * 0.00005
    return { bid: mid - halfSpread, ask: mid + halfSpread, mid }
  } catch {
    return null
  }
}
