import type { Candle, Timeframe } from '@/types/forex'
import { CURRENCY_PAIRS } from '@/lib/forex/pairs'

const BASE_URL = 'https://www.alphavantage.co/query'

export function isConfigured(): boolean {
  return Boolean(process.env.ALPHA_VANTAGE_API_KEY)
}

function getApiKey(): string {
  return process.env.ALPHA_VANTAGE_API_KEY ?? ''
}

function pairToFromTo(pair: string): { from: string; to: string } | null {
  const parts = pair.split('/')
  if (parts.length !== 2) return null
  return { from: parts[0], to: parts[1] }
}

function timeframeToInterval(timeframe: Timeframe): string {
  switch (timeframe) {
    case '1m': return '1min'
    case '5m': return '5min'
    case '15m': return '15min'
    case '1h': return '60min'
    case '4h': return '60min' // resample from 1h
    case '1d': return 'daily'
  }
}

function parseIntradayResponse(data: Record<string, unknown>, interval: string): Candle[] {
  const key = `Time Series FX (${interval})`
  const series = data[key] as Record<string, Record<string, string>> | undefined
  if (!series) return []

  return Object.entries(series)
    .map(([timeStr, values]) => ({
      time: new Date(timeStr).getTime(),
      open: parseFloat(values['1. open']),
      high: parseFloat(values['2. high']),
      low: parseFloat(values['3. low']),
      close: parseFloat(values['4. close']),
      volume: 0,
    }))
    .filter((c) => !isNaN(c.time) && !isNaN(c.open))
    .sort((a, b) => a.time - b.time)
}

function parseDailyResponse(data: Record<string, unknown>): Candle[] {
  const series = data['Time Series FX (Daily)'] as Record<string, Record<string, string>> | undefined
  if (!series) return []

  return Object.entries(series)
    .map(([timeStr, values]) => ({
      time: new Date(timeStr).getTime(),
      open: parseFloat(values['1. open']),
      high: parseFloat(values['2. high']),
      low: parseFloat(values['3. low']),
      close: parseFloat(values['4. close']),
      volume: 0,
    }))
    .filter((c) => !isNaN(c.time) && !isNaN(c.open))
    .sort((a, b) => a.time - b.time)
}

function resample4h(candles1h: Candle[]): Candle[] {
  const grouped: Candle[] = []
  for (let i = 0; i < candles1h.length; i += 4) {
    const group = candles1h.slice(i, i + 4)
    if (group.length === 0) continue
    grouped.push({
      time: group[0].time,
      open: group[0].open,
      high: Math.max(...group.map((c) => c.high)),
      low: Math.min(...group.map((c) => c.low)),
      close: group[group.length - 1].close,
      volume: group.reduce((sum, c) => sum + c.volume, 0),
    })
  }
  return grouped
}

export async function fetchCandles(
  pair: string,
  timeframe: Timeframe,
  count: number
): Promise<Candle[]> {
  const apiKey = getApiKey()
  if (!apiKey) return []

  const fromTo = pairToFromTo(pair)
  if (!fromTo) return []

  try {
    let candles: Candle[]

    if (timeframe === '1d') {
      const url = `${BASE_URL}?function=FX_DAILY&from_symbol=${fromTo.from}&to_symbol=${fromTo.to}&outputsize=full&apikey=${apiKey}`
      const res = await fetch(url)
      const data = (await res.json()) as Record<string, unknown>
      candles = parseDailyResponse(data)
    } else {
      const interval = timeframeToInterval(timeframe)
      const url = `${BASE_URL}?function=FX_INTRADAY&from_symbol=${fromTo.from}&to_symbol=${fromTo.to}&interval=${interval}&outputsize=full&apikey=${apiKey}`
      const res = await fetch(url)
      const data = (await res.json()) as Record<string, unknown>
      candles = parseIntradayResponse(data, interval)

      if (timeframe === '4h') {
        candles = resample4h(candles)
      }
    }

    // Return last `count` candles
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

  const fromTo = pairToFromTo(pair)
  if (!fromTo) return null

  try {
    const url = `${BASE_URL}?function=CURRENCY_EXCHANGE_RATE&from_currency=${fromTo.from}&to_currency=${fromTo.to}&apikey=${apiKey}`
    const res = await fetch(url)
    const data = (await res.json()) as Record<string, unknown>

    const rateData = data['Realtime Currency Exchange Rate'] as Record<string, string> | undefined
    if (!rateData) return null

    const pairConfig = CURRENCY_PAIRS.find((p) => p.symbol === pair)
    const digits = pairConfig?.digits ?? 5

    const mid = parseFloat(parseFloat(rateData['5. Exchange Rate']).toFixed(digits))
    if (isNaN(mid)) return null

    const spreadApprox = 0.0002 * mid
    const bid = parseFloat((mid - spreadApprox).toFixed(digits))
    const ask = parseFloat((mid + spreadApprox).toFixed(digits))

    return { bid, ask, mid }
  } catch {
    return null
  }
}
