import { Candle } from '@/types/forex'

export function sma(candles: Candle[], period: number): number[] {
  const result: number[] = new Array(candles.length).fill(NaN)
  for (let i = period - 1; i < candles.length; i++) {
    const sum = candles.slice(i - period + 1, i + 1).reduce((acc, c) => acc + c.close, 0)
    result[i] = sum / period
  }
  return result
}

export function ema(candles: Candle[], period: number): number[] {
  const result: number[] = new Array(candles.length).fill(NaN)
  if (candles.length < period) return result

  const k = 2 / (period + 1)

  // Seed with SMA for first value
  let emaVal = candles.slice(0, period).reduce((acc, c) => acc + c.close, 0) / period
  result[period - 1] = emaVal

  for (let i = period; i < candles.length; i++) {
    emaVal = candles[i].close * k + emaVal * (1 - k)
    result[i] = emaVal
  }

  return result
}

export function rsi(candles: Candle[], period: number): number[] {
  const result: number[] = new Array(candles.length).fill(NaN)
  if (candles.length < period + 1) return result

  let avgGain = 0
  let avgLoss = 0

  // First period
  for (let i = 1; i <= period; i++) {
    const change = candles[i].close - candles[i - 1].close
    if (change > 0) avgGain += change
    else avgLoss += Math.abs(change)
  }

  avgGain /= period
  avgLoss /= period

  if (avgLoss === 0) {
    result[period] = 100
  } else {
    result[period] = 100 - 100 / (1 + avgGain / avgLoss)
  }

  // Subsequent periods using smoothed average
  for (let i = period + 1; i < candles.length; i++) {
    const change = candles[i].close - candles[i - 1].close
    const gain = change > 0 ? change : 0
    const loss = change < 0 ? Math.abs(change) : 0

    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period

    if (avgLoss === 0) {
      result[i] = 100
    } else {
      result[i] = 100 - 100 / (1 + avgGain / avgLoss)
    }
  }

  return result
}

export function macd(
  candles: Candle[],
  fast: number,
  slow: number,
  signalPeriod: number
): { macd: number; signal: number; histogram: number }[] {
  const result = candles.map(() => ({
    macd: NaN,
    signal: NaN,
    histogram: NaN,
  }))

  if (candles.length < slow + signalPeriod) return result

  const emaFast = ema(candles, fast)
  const emaSlow = ema(candles, slow)

  // Compute MACD line
  const macdLine: number[] = new Array(candles.length).fill(NaN)
  for (let i = slow - 1; i < candles.length; i++) {
    if (!isNaN(emaFast[i]) && !isNaN(emaSlow[i])) {
      macdLine[i] = emaFast[i] - emaSlow[i]
    }
  }

  // Compute signal line (EMA of MACD line)
  // Find first valid MACD value
  let firstValid = -1
  for (let i = 0; i < macdLine.length; i++) {
    if (!isNaN(macdLine[i])) {
      firstValid = i
      break
    }
  }

  if (firstValid === -1) return result

  // Seed signal EMA
  const k = 2 / (signalPeriod + 1)
  let sigEma = 0
  let validCount = 0

  for (let i = firstValid; i < candles.length; i++) {
    if (isNaN(macdLine[i])) continue
    validCount++

    if (validCount < signalPeriod) {
      sigEma += macdLine[i]
    } else if (validCount === signalPeriod) {
      sigEma = (sigEma + macdLine[i]) / signalPeriod
      result[i].macd = macdLine[i]
      result[i].signal = sigEma
      result[i].histogram = macdLine[i] - sigEma
    } else {
      sigEma = macdLine[i] * k + sigEma * (1 - k)
      result[i].macd = macdLine[i]
      result[i].signal = sigEma
      result[i].histogram = macdLine[i] - sigEma
    }
  }

  return result
}

export function bollingerBands(
  candles: Candle[],
  period: number,
  stdDev: number
): { upper: number; middle: number; lower: number }[] {
  const result = candles.map(() => ({
    upper: NaN,
    middle: NaN,
    lower: NaN,
  }))

  for (let i = period - 1; i < candles.length; i++) {
    const slice = candles.slice(i - period + 1, i + 1).map((c) => c.close)
    const mean = slice.reduce((a, b) => a + b, 0) / period
    const variance = slice.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / period
    const std = Math.sqrt(variance)

    result[i] = {
      middle: mean,
      upper: mean + stdDev * std,
      lower: mean - stdDev * std,
    }
  }

  return result
}

// Wilder's ADX — trend strength (0–100), direction-agnostic
export function adx(candles: Candle[], period: number): number[] {
  const result: number[] = new Array(candles.length).fill(NaN)
  if (candles.length < period * 2 + 1) return result

  const tr: number[] = []
  const plusDM: number[] = []
  const minusDM: number[] = []

  for (let i = 1; i < candles.length; i++) {
    const upMove = candles[i].high - candles[i - 1].high
    const downMove = candles[i - 1].low - candles[i].low
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0)
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0)
    const hl = candles[i].high - candles[i].low
    const hc = Math.abs(candles[i].high - candles[i - 1].close)
    const lc = Math.abs(candles[i].low - candles[i - 1].close)
    tr.push(Math.max(hl, hc, lc))
  }

  // Wilder smoothing
  let trS = tr.slice(0, period).reduce((a, b) => a + b, 0)
  let plusS = plusDM.slice(0, period).reduce((a, b) => a + b, 0)
  let minusS = minusDM.slice(0, period).reduce((a, b) => a + b, 0)

  const dx: number[] = []
  for (let i = period; i < tr.length; i++) {
    trS = trS - trS / period + tr[i]
    plusS = plusS - plusS / period + plusDM[i]
    minusS = minusS - minusS / period + minusDM[i]
    const plusDI = trS > 0 ? (100 * plusS) / trS : 0
    const minusDI = trS > 0 ? (100 * minusS) / trS : 0
    const sum = plusDI + minusDI
    dx.push(sum > 0 ? (100 * Math.abs(plusDI - minusDI)) / sum : 0)

    if (dx.length === period) {
      result[i + 1] = dx.reduce((a, b) => a + b, 0) / period
    } else if (dx.length > period) {
      result[i + 1] = (result[i] * (period - 1) + dx[dx.length - 1]) / period
    }
  }

  return result
}

export function atr(candles: Candle[], period: number): number[] {
  const result: number[] = new Array(candles.length).fill(NaN)
  if (candles.length < period + 1) return result

  const trueRanges: number[] = []
  for (let i = 1; i < candles.length; i++) {
    const hl = candles[i].high - candles[i].low
    const hc = Math.abs(candles[i].high - candles[i - 1].close)
    const lc = Math.abs(candles[i].low - candles[i - 1].close)
    trueRanges.push(Math.max(hl, hc, lc))
  }

  // First ATR is simple average
  let atrVal = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period
  result[period] = atrVal

  for (let i = period; i < trueRanges.length; i++) {
    atrVal = (atrVal * (period - 1) + trueRanges[i]) / period
    result[i + 1] = atrVal
  }

  return result
}
