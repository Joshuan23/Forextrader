/**
 * OANDA v20 fetcher — real broker forex/metal/index OHLCV with no daily
 * request cap (practice or live account token). Works from cloud IPs.
 * Rate limit is ~120 req/min per token; there is no daily quota.
 *
 * Setup: create a free practice account at oanda.com, then generate an
 * API token (Account → "Manage API Access"). Set OANDA_API_TOKEN.
 * Practice is the default host; set OANDA_API_URL to override (live is
 * https://api-fxtrade.oanda.com).
 *
 * https://developer.oanda.com/rest-live-v20/instrument-ep/
 */

import type { Candle, Timeframe } from '@/types/forex'
import { CURRENCY_PAIRS } from '@/lib/forex/pairs'

const PRACTICE_URL = 'https://api-fxpractice.oanda.com'

export function isConfigured(): boolean {
  return Boolean(process.env.OANDA_API_TOKEN)
}

function baseUrl(): string {
  return process.env.OANDA_API_URL || PRACTICE_URL
}

// OANDA instruments use underscores; indices/metals have dedicated tickers.
const INSTRUMENT: Record<string, string> = {
  NAS100: 'NAS100_USD',
  US500: 'SPX500_USD',
}

function toInstrument(pair: string): string {
  return INSTRUMENT[pair] ?? pair.replace('/', '_')
}

// OANDA supports H4 and D natively — no resampling needed.
function toGranularity(timeframe: Timeframe): string {
  switch (timeframe) {
    case '1m': return 'M1'
    case '5m': return 'M5'
    case '15m': return 'M15'
    case '1h': return 'H1'
    case '4h': return 'H4'
    case '1d': return 'D'
  }
}

async function oandaGet(path: string): Promise<Response> {
  return fetch(`${baseUrl()}${path}`, {
    headers: {
      Authorization: `Bearer ${process.env.OANDA_API_TOKEN}`,
      // UNIX datetime format returns epoch seconds as a string — trivial to parse.
      'Accept-Datetime-Format': 'UNIX',
    },
    next: { revalidate: 60 },
    signal: AbortSignal.timeout(6000),
  })
}

interface OandaCandle {
  complete: boolean
  volume: number
  time: string // epoch seconds (UNIX format), e.g. "1704110400.000000000"
  mid?: { o: string; h: string; l: string; c: string }
}

export async function fetchCandles(
  pair: string,
  timeframe: Timeframe,
  count: number
): Promise<Candle[]> {
  if (!isConfigured()) return []

  try {
    const size = Math.min(Math.max(count, 1), 5000)
    const path =
      `/v3/instruments/${toInstrument(pair)}/candles` +
      `?granularity=${toGranularity(timeframe)}&count=${size}&price=M`
    const res = await oandaGet(path)
    if (!res.ok) return []

    const data = (await res.json()) as { candles?: OandaCandle[] }
    if (!Array.isArray(data.candles)) return []

    const candles: Candle[] = data.candles
      .filter((c) => c.mid)
      .map((c) => ({
        time: Math.round(parseFloat(c.time) * 1000),
        open: parseFloat(c.mid!.o),
        high: parseFloat(c.mid!.h),
        low: parseFloat(c.mid!.l),
        close: parseFloat(c.mid!.c),
        volume: c.volume ?? 0,
      }))
      .filter((c) => isFinite(c.time) && isFinite(c.open) && isFinite(c.close))
      .sort((a, b) => a.time - b.time)

    return candles.slice(-count)
  } catch {
    return []
  }
}

export async function fetchLiveRate(
  pair: string
): Promise<{ bid: number; ask: number; mid: number } | null> {
  if (!isConfigured()) return null

  try {
    // Latest M1 candle (incomplete = current forming bar) gives the live mid,
    // avoiding the need for an account id on the pricing endpoint.
    const path =
      `/v3/instruments/${toInstrument(pair)}/candles?granularity=M1&count=1&price=M`
    const res = await oandaGet(path)
    if (!res.ok) return null

    const data = (await res.json()) as { candles?: OandaCandle[] }
    const last = data.candles?.[data.candles.length - 1]
    if (!last?.mid) return null

    const pairConfig = CURRENCY_PAIRS.find((p) => p.symbol === pair)
    const digits = pairConfig?.digits ?? 5
    const mid = parseFloat(parseFloat(last.mid.c).toFixed(digits))
    if (!isFinite(mid) || mid <= 0) return null

    const halfSpread = pairConfig
      ? (pairConfig.spread * pairConfig.pipSize) / 2
      : mid * 0.00005
    return { bid: mid - halfSpread, ask: mid + halfSpread, mid }
  } catch {
    return null
  }
}
