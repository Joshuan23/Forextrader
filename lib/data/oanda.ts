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

// ── Order / Position book (retail-forex DOM) ─────────────────────────
// OANDA exposes aggregated retail order & position books: at each price
// bucket, the % of open orders/positions that are long vs short. Big
// buckets = resting liquidity (stop clusters) that price is drawn to —
// the pools ICT liquidity sweeps target.

export interface LiquidityBucket {
  price: number
  percent: number // total order/position interest at this bucket (long+short)
}
export interface BookAnalysis {
  price: number // snapshot mid at capture
  time: number
  aboveClusters: LiquidityBucket[] // largest pools above price (buy-side liquidity)
  belowClusters: LiquidityBucket[] // largest pools below price (sell-side liquidity)
}

interface RawBucket {
  price: string
  longCountPercent: string
  shortCountPercent: string
}

function analyzeBook(raw: { price: string; buckets?: RawBucket[]; time?: string } | undefined): BookAnalysis | null {
  if (!raw?.buckets?.length) return null
  const price = parseFloat(raw.price)
  if (!isFinite(price)) return null
  const parsed = raw.buckets
    .map((b) => ({
      price: parseFloat(b.price),
      percent: parseFloat(b.longCountPercent) + parseFloat(b.shortCountPercent),
    }))
    .filter((b) => isFinite(b.price) && isFinite(b.percent) && b.percent > 0)
  const top = (side: 'above' | 'below') =>
    parsed
      .filter((b) => (side === 'above' ? b.price > price : b.price < price))
      .sort((a, b) => b.percent - a.percent)
      .slice(0, 3)
      .map((b) => ({ price: Math.round(b.price * 1e6) / 1e6, percent: Math.round(b.percent * 100) / 100 }))
  return {
    price,
    time: raw.time ? Math.round(parseFloat(raw.time) * 1000) : Date.now(),
    aboveClusters: top('above'),
    belowClusters: top('below'),
  }
}

async function fetchBook(pair: string, kind: 'orderBook' | 'positionBook'): Promise<BookAnalysis | null> {
  if (!isConfigured()) return null
  try {
    const res = await oandaGet(`/v3/instruments/${toInstrument(pair)}/${kind}`)
    if (!res.ok) return null
    const data = (await res.json()) as Record<string, { price: string; buckets?: RawBucket[]; time?: string }>
    return analyzeBook(data[kind])
  } catch {
    return null
  }
}

// Order book: resting limit orders (includes stop clusters). The primary
// liquidity map for sweep analysis.
export function fetchOrderBook(pair: string): Promise<BookAnalysis | null> {
  return fetchBook(pair, 'orderBook')
}

// Position book: where open positions sit — crowded longs/shorts whose
// stops become the next liquidity target.
export function fetchPositionBook(pair: string): Promise<BookAnalysis | null> {
  return fetchBook(pair, 'positionBook')
}

// Diagnostic: call OANDA directly and surface the REAL status/error so a
// misconfigured token/environment is visible instead of silently falling
// back to Yahoo. Never returns the token itself.
export async function diagnoseOanda(pair = 'EUR/USD'): Promise<Record<string, unknown>> {
  const tokenSet = Boolean(process.env.OANDA_API_TOKEN)
  const out: Record<string, unknown> = {
    tokenSet,
    apiUrl: baseUrl(),
    environment: baseUrl().includes('fxpractice') ? 'practice' : 'live',
    instrument: toInstrument(pair),
  }
  if (!tokenSet) {
    out.error = 'OANDA_API_TOKEN is not set'
    return out
  }
  try {
    const res = await oandaGet(`/v3/instruments/${toInstrument(pair)}/candles?granularity=H1&count=1&price=M`)
    out.candlesStatus = res.status
    if (res.ok) out.candlesOk = true
    else out.candlesBody = (await res.text()).slice(0, 400)
  } catch (e) {
    out.candlesError = e instanceof Error ? e.message : 'fetch failed'
  }
  try {
    const ob = await oandaGet(`/v3/instruments/${toInstrument(pair)}/orderBook`)
    out.orderBookStatus = ob.status
    if (!ob.ok) out.orderBookBody = (await ob.text()).slice(0, 400)
  } catch (e) {
    out.orderBookError = e instanceof Error ? e.message : 'fetch failed'
  }
  return out
}

interface OhlcStrings {
  o: string
  h: string
  l: string
  c: string
}
interface OandaCandle {
  complete: boolean
  volume: number
  time: string // epoch seconds (UNIX format), e.g. "1704110400.000000000"
  mid?: OhlcStrings
  bid?: OhlcStrings
  ask?: OhlcStrings
}

// Candle OHLC uses the BID price to match MetaTrader / TradingView charts,
// which are drawn from bid. (OANDA can return bid/ask/mid; retail charts
// are bid, so signal levels line up with what the user sees on MT.)
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
      `?granularity=${toGranularity(timeframe)}&count=${size}&price=B`
    const res = await oandaGet(path)
    if (!res.ok) return []

    const data = (await res.json()) as { candles?: OandaCandle[] }
    if (!Array.isArray(data.candles)) return []

    const candles: Candle[] = data.candles
      .map((c): Candle | null => {
        const o = c.bid ?? c.mid
        if (!o) return null
        return {
          time: Math.round(parseFloat(c.time) * 1000),
          open: parseFloat(o.o),
          high: parseFloat(o.h),
          low: parseFloat(o.l),
          close: parseFloat(o.c),
          volume: c.volume ?? 0,
        }
      })
      .filter((c): c is Candle => c !== null && isFinite(c.time) && isFinite(c.open) && isFinite(c.close))
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
    // Latest M1 candle (incomplete = current forming bar) with both bid and
    // ask gives a real live quote and real spread — no account id needed.
    const path =
      `/v3/instruments/${toInstrument(pair)}/candles?granularity=M1&count=1&price=BA`
    const res = await oandaGet(path)
    if (!res.ok) return null

    const data = (await res.json()) as { candles?: OandaCandle[] }
    const last = data.candles?.[data.candles.length - 1]
    if (!last?.bid || !last?.ask) return null

    const pairConfig = CURRENCY_PAIRS.find((p) => p.symbol === pair)
    const digits = pairConfig?.digits ?? 5
    const round = (n: number) => parseFloat(n.toFixed(digits))
    const bid = round(parseFloat(last.bid.c))
    const ask = round(parseFloat(last.ask.c))
    if (!isFinite(bid) || !isFinite(ask) || bid <= 0) return null

    // Mid is the true midpoint; bid matches what MetaTrader charts display.
    return { bid, ask, mid: round((bid + ask) / 2) }
  } catch {
    return null
  }
}
