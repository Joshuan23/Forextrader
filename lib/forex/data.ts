import { Candle, LivePrice, Timeframe } from '@/types/forex'
import { CURRENCY_PAIRS, getPairBySymbol } from './pairs'

// Seeded pseudo-random number generator (mulberry32)
function mulberry32(seed: number): () => number {
  let s = seed
  return function () {
    s |= 0
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Box-Muller transform to get normal distribution from uniform
function boxMuller(rand: () => number): number {
  const u1 = Math.max(1e-10, rand())
  const u2 = rand()
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}

// Timeframe duration in minutes
function timeframeDurationMinutes(tf: Timeframe): number {
  switch (tf) {
    case '1m': return 1
    case '5m': return 5
    case '15m': return 15
    case '1h': return 60
    case '4h': return 240
    case '1d': return 1440
  }
}

// Annual volatility by instrument (GBM sigma)
const VOLATILITIES: Record<string, number> = {
  // Forex
  'EUR/USD': 0.08,
  'GBP/USD': 0.10,
  'USD/JPY': 0.09,
  'USD/CHF': 0.09,
  'AUD/USD': 0.11,
  'USD/CAD': 0.08,
  'NZD/USD': 0.12,
  'EUR/GBP': 0.07,
  // Metals
  'XAU/USD': 0.15,
  'XAG/USD': 0.28,
  // Indices
  'NAS100':  0.22,
  'US500':   0.18,
}

export function generateCandles(
  pair: string,
  timeframe: Timeframe,
  count: number,
  endDate?: Date
): Candle[] {
  const pairInfo = getPairBySymbol(pair)
  if (!pairInfo) return []

  const vol = VOLATILITIES[pair] ?? 0.09
  const minutesPerCandle = timeframeDurationMinutes(timeframe)
  const minutesPerYear = 525600
  const dt = minutesPerCandle / minutesPerYear

  const mu = 0.0  // drift (zero for simplicity)

  const end = endDate ?? new Date()
  const startMs = end.getTime() - count * minutesPerCandle * 60 * 1000

  // Create a seed based on pair + date for reproducible data
  const dateSeed = Math.floor(startMs / (1000 * 60 * 60 * 24))
  const pairSeed = pair.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const rand = mulberry32(dateSeed + pairSeed * 1000)

  const candles: Candle[] = []
  let price = pairInfo.basePrice

  for (let i = 0; i < count; i++) {
    const time = startMs + i * minutesPerCandle * 60 * 1000
    const open = price

    // Geometric Brownian Motion
    const z = boxMuller(rand)
    const returnVal = (mu - (vol * vol) / 2) * dt + vol * Math.sqrt(dt) * z
    const close = open * Math.exp(returnVal)

    // High and Low using additional noise
    const z2 = Math.abs(boxMuller(rand))
    const highMultiplier = 1 + z2 * vol * Math.sqrt(dt) * 0.5
    const lowMultiplier = 1 - Math.abs(boxMuller(rand)) * vol * Math.sqrt(dt) * 0.5

    const high = Math.max(open, close) * highMultiplier
    const low = Math.min(open, close) * lowMultiplier

    // Volume: random between 500 and 5000
    const volume = Math.floor(500 + rand() * 4500)

    candles.push({
      time,
      open: parseFloat(open.toFixed(pairInfo.digits)),
      high: parseFloat(high.toFixed(pairInfo.digits)),
      low: parseFloat(low.toFixed(pairInfo.digits)),
      close: parseFloat(close.toFixed(pairInfo.digits)),
      volume,
    })

    price = close
  }

  return candles
}

export function getLivePrice(pair: string): LivePrice {
  const pairInfo = getPairBySymbol(pair)
  if (!pairInfo) {
    return {
      pair,
      bid: 0,
      ask: 0,
      mid: 0,
      change: 0,
      changeAbs: 0,
      high: 0,
      low: 0,
      time: Date.now(),
    }
  }

  // Generate today's candles and get the last one
  const todayCandles = generateCandles(pair, '1h', 24)
  const lastCandle = todayCandles[todayCandles.length - 1]
  const firstCandle = todayCandles[0]

  // Add small random walk using current time as seed
  const timeSeed = Math.floor(Date.now() / 1000) // changes every second
  const pairSeed = pair.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const rand = mulberry32(timeSeed + pairSeed)
  const walk = (rand() - 0.5) * 0.001  // ±0.1% random walk

  const mid = parseFloat((lastCandle.close * (1 + walk)).toFixed(pairInfo.digits))
  const halfSpread = (pairInfo.spread * pairInfo.pipSize) / 2
  const bid = parseFloat((mid - halfSpread).toFixed(pairInfo.digits))
  const ask = parseFloat((mid + halfSpread).toFixed(pairInfo.digits))

  const openPrice = firstCandle.open
  const changeAbs = parseFloat((mid - openPrice).toFixed(pairInfo.digits))
  const change = parseFloat(((changeAbs / openPrice) * 100).toFixed(3))

  const high = parseFloat(Math.max(...todayCandles.map((c) => c.high)).toFixed(pairInfo.digits))
  const low = parseFloat(Math.min(...todayCandles.map((c) => c.low)).toFixed(pairInfo.digits))

  return {
    pair,
    bid,
    ask,
    mid,
    change,
    changeAbs,
    high,
    low,
    time: Date.now(),
  }
}

export function getAllLivePrices(): LivePrice[] {
  return CURRENCY_PAIRS.map((p) => getLivePrice(p.symbol))
}

/**
 * Generates candles identical in shape to generateCandles() but scaled so the
 * last candle's close equals `anchorPrice` (a real market price).
 * Ensures the chart ends at the correct level even when using synthetic history.
 */
export function generateAnchoredCandles(
  pair: string,
  timeframe: Timeframe,
  count: number,
  anchorPrice: number,
): Candle[] {
  const pairInfo = getPairBySymbol(pair)
  if (!pairInfo || anchorPrice <= 0) return generateCandles(pair, timeframe, count)

  const candles = generateCandles(pair, timeframe, count)
  if (candles.length === 0) return candles

  const lastClose = candles[candles.length - 1].close
  if (lastClose === 0) return candles

  const scale = anchorPrice / lastClose
  return candles.map(c => ({
    ...c,
    open:  parseFloat((c.open  * scale).toFixed(pairInfo.digits)),
    high:  parseFloat((c.high  * scale).toFixed(pairInfo.digits)),
    low:   parseFloat((c.low   * scale).toFixed(pairInfo.digits)),
    close: parseFloat((c.close * scale).toFixed(pairInfo.digits)),
  }))
}
