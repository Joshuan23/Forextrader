import type { Candle } from '@/types/forex'
import { adx, atr, ema } from '@/lib/forex/indicators'
import type { RegimeState, RegimeTag } from './types'
import { REGIME_LABELS } from './types'

const ADX_TREND = 22
const ATR_PERIOD = 14
const PERCENTILE_WINDOW = 100

// Classify the market regime from signal-timeframe candles.
export function classifyRegime(candles: Candle[], pipSize: number): RegimeState {
  const atrSeries = atr(candles, ATR_PERIOD)
  const adxSeries = adx(candles, ATR_PERIOD)
  const ema20 = ema(candles, 20)
  const ema50 = ema(candles, 50)

  const last = candles.length - 1
  const currentAtr = lastValid(atrSeries) ?? 0
  const currentAdx = lastValid(adxSeries) ?? 0
  const price = candles[last]?.close ?? 0

  const window = atrSeries.filter((v) => !isNaN(v)).slice(-PERCENTILE_WINDOW)
  const below = window.filter((v) => v <= currentAtr).length
  const atrPercentile = window.length > 0 ? Math.round((below / window.length) * 100) : 50
  const sorted = [...window].sort((a, b) => a - b)
  const medianAtr = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : currentAtr

  const e20 = lastValid(ema20) ?? price
  const e50 = lastValid(ema50) ?? price
  const emaUp = e20 > e50 && price > e20
  const emaDown = e20 < e50 && price < e20

  let tag: RegimeTag
  if (atrPercentile >= 92 && currentAtr > medianAtr * 1.8) {
    tag = 'volatile_expansion'
  } else if (currentAdx >= ADX_TREND && emaUp) {
    tag = 'trending_up'
  } else if (currentAdx >= ADX_TREND && emaDown) {
    tag = 'trending_down'
  } else if (atrPercentile <= 15) {
    tag = 'quiet'
  } else {
    tag = 'ranging'
  }

  const atrPips = pipSize > 0 ? currentAtr / pipSize : 0
  const medianAtrPips = pipSize > 0 ? medianAtr / pipSize : 0

  return {
    tag,
    adx: round1(currentAdx),
    atr: currentAtr,
    atrPips: round1(atrPips),
    atrPercentile,
    medianAtrPips: round1(medianAtrPips),
    emaAligned: emaUp || emaDown,
    description: describe(tag, currentAdx, atrPercentile),
  }
}

// 0–100 score: how tradable is this regime for the given setup direction bias.
export function regimeScore(regime: RegimeState): { score: number; note: string } {
  switch (regime.tag) {
    case 'trending_up':
    case 'trending_down':
      return { score: 90, note: `Clear trend (ADX ${regime.adx})` }
    case 'ranging':
      return { score: 62, note: `Range conditions (ADX ${regime.adx}) — mean-reversion setups only` }
    case 'quiet':
      return { score: 35, note: `Volatility compressed (ATR P${regime.atrPercentile}) — poor follow-through risk` }
    case 'volatile_expansion':
      return { score: 30, note: `Volatility expansion (ATR P${regime.atrPercentile}) — slippage and whipsaw risk` }
  }
}

function describe(tag: RegimeTag, adxVal: number, atrPct: number): string {
  const base = REGIME_LABELS[tag]
  return `${base} — ADX ${Math.round(adxVal)}, ATR percentile ${atrPct}`
}

function lastValid(series: number[]): number | undefined {
  for (let i = series.length - 1; i >= 0; i--) {
    if (!isNaN(series[i])) return series[i]
  }
  return undefined
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}
