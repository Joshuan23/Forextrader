/**
 * Twelve Data fetcher — real forex/metal OHLCV, works from cloud IPs
 * (unlike Yahoo, which blocks Vercel). Free tier: 800 requests/day,
 * 8 requests/minute. Set TWELVE_DATA_API_KEY to enable.
 *
 * https://twelvedata.com/docs
 */

import type { Candle, Timeframe } from '@/types/forex'
import { CURRENCY_PAIRS } from '@/lib/forex/pairs'

const BASE_URL = 'https://api.twelvedata.com'

export function isConfigured(): boolean {
  return Boolean(process.env.TWELVE_DATA_API_KEY)
}

function getApiKey(): string {
  return process.env.TWELVE_DATA_API_KEY ?? ''
}

// Twelve Data uses "EUR/USD" style symbols directly for FX and metals.
// Indices map to their Twelve Data tickers (may require a paid plan —
// they fail gracefully to the next provider / simulation).
const SYMBOL: Record<string, string> = {
  NAS100: 'NDX',
  US500: 'SPX',
}

function toSymbol(pair: string): string {
  return SYMBOL[pair] ?? pair
}

// Twelve Data supports 4h natively — no resampling needed.
function toInterval(timeframe: Timeframe): string {
  switch (timeframe) {
    case '1m': return '1min'
    case '5m': return '5min'
    case '15m': return '15min'
    case '1h': return '1h'
    case '4h': return '4h'
    case '1d': return '1day'
  }
}

// Forex/metal datetimes are UTC. "2024-01-01 12:00:00" → epoch ms;
// daily bars arrive date-only ("2024-01-01").
function parseDt(dt: string): number {
  const iso = dt.includes(' ') ? `${dt.replace(' ', 'T')}Z` : `${dt}T00:00:00Z`
  return new Date(iso).getTime()
}

export async function fetchCandles(
  pair: string,
  timeframe: Timeframe,
  count: number
): Promise<Candle[]> {
  const apiKey = getApiKey()
  if (!apiKey) return []

  try {
    const size = Math.min(Math.max(count, 1), 5000)
    const url =
      `${BASE_URL}/time_series?symbol=${encodeURIComponent(toSymbol(pair))}` +
      `&interval=${toInterval(timeframe)}&outputsize=${size}&format=JSON&apikey=${apiKey}`
    const res = await fetch(url, { next: { revalidate: 60 }, signal: AbortSignal.timeout(6000) })
    if (!res.ok) return []

    const data = (await res.json()) as {
      status?: string
      values?: { datetime: string; open: string; high: string; low: string; close: string; volume?: string }[]
    }
    if (data.status === 'error' || !Array.isArray(data.values)) return []

    const candles: Candle[] = data.values
      .map((v) => ({
        time: parseDt(v.datetime),
        open: parseFloat(v.open),
        high: parseFloat(v.high),
        low: parseFloat(v.low),
        close: parseFloat(v.close),
        volume: v.volume ? parseFloat(v.volume) : 0,
      }))
      .filter((c) => isFinite(c.time) && isFinite(c.open) && isFinite(c.close))
      .sort((a, b) => a.time - b.time) // Twelve Data returns newest-first

    return candles.slice(-count)
  } catch {
    return []
  }
}

export async function fetchLiveRate(
  pair: string
): Promise<{ bid: number; ask: number; mid: number } | null> {
  const apiKey = getApiKey()
  if (!apiKey) return null

  try {
    const url = `${BASE_URL}/price?symbol=${encodeURIComponent(toSymbol(pair))}&apikey=${apiKey}`
    const res = await fetch(url, { next: { revalidate: 30 }, signal: AbortSignal.timeout(6000) })
    if (!res.ok) return null

    const data = (await res.json()) as { price?: string; status?: string }
    if (data.status === 'error' || !data.price) return null

    const pairConfig = CURRENCY_PAIRS.find((p) => p.symbol === pair)
    const digits = pairConfig?.digits ?? 5
    const mid = parseFloat(parseFloat(data.price).toFixed(digits))
    if (!isFinite(mid) || mid <= 0) return null

    const halfSpread = pairConfig
      ? (pairConfig.spread * pairConfig.pipSize) / 2
      : mid * 0.00005
    return { bid: mid - halfSpread, ask: mid + halfSpread, mid }
  } catch {
    return null
  }
}
