import type { Candle } from '@/types/forex'
import type { SwingPoint, StructureBreak, MarketStructure, MarketBias } from '@/types/smc'

const SWING_LOOKBACK = 3

export function detectSwingPoints(candles: Candle[]): SwingPoint[] {
  const swings: SwingPoint[] = []

  for (let i = SWING_LOOKBACK; i < candles.length - SWING_LOOKBACK; i++) {
    const candle = candles[i]

    // Check swing high
    let isSwingHigh = true
    for (let j = i - SWING_LOOKBACK; j <= i + SWING_LOOKBACK; j++) {
      if (j !== i && candles[j].high >= candle.high) {
        isSwingHigh = false
        break
      }
    }

    if (isSwingHigh) {
      // Determine significance: major if no higher high within 10 candles on each side
      const lookbackExtended = 10
      let isMajor = true
      const left = Math.max(0, i - lookbackExtended)
      const right = Math.min(candles.length - 1, i + lookbackExtended)
      for (let j = left; j <= right; j++) {
        if (j !== i && candles[j].high > candle.high) {
          isMajor = false
          break
        }
      }

      swings.push({
        index: i,
        time: candle.time,
        price: candle.high,
        type: 'high',
        significance: isMajor ? 'major' : 'minor',
      })
    }

    // Check swing low
    let isSwingLow = true
    for (let j = i - SWING_LOOKBACK; j <= i + SWING_LOOKBACK; j++) {
      if (j !== i && candles[j].low <= candle.low) {
        isSwingLow = false
        break
      }
    }

    if (isSwingLow) {
      // Determine significance: major if no lower low within 10 candles on each side
      const lookbackExtended = 10
      let isMajor = true
      const left = Math.max(0, i - lookbackExtended)
      const right = Math.min(candles.length - 1, i + lookbackExtended)
      for (let j = left; j <= right; j++) {
        if (j !== i && candles[j].low < candle.low) {
          isMajor = false
          break
        }
      }

      swings.push({
        index: i,
        time: candle.time,
        price: candle.low,
        type: 'low',
        significance: isMajor ? 'major' : 'minor',
      })
    }
  }

  return swings
}

export function detectStructureBreaks(candles: Candle[], swings: SwingPoint[]): StructureBreak[] {
  const breaks: StructureBreak[] = []
  const seenTimes = new Set<number>()

  if (swings.length < 2) return breaks

  // Determine initial trend from last 2 swing highs/lows
  const swingHighs = swings.filter((s) => s.type === 'high').sort((a, b) => a.index - b.index)
  const swingLows = swings.filter((s) => s.type === 'low').sort((a, b) => a.index - b.index)

  let trendUp: boolean | null = null

  if (swingHighs.length >= 2 && swingLows.length >= 2) {
    const lastTwoHighs = swingHighs.slice(-2)
    const lastTwoLows = swingLows.slice(-2)
    const hhPattern = lastTwoHighs[1].price > lastTwoHighs[0].price
    const hlPattern = lastTwoLows[1].price > lastTwoLows[0].price
    const lhPattern = lastTwoHighs[1].price < lastTwoHighs[0].price
    const llPattern = lastTwoLows[1].price < lastTwoLows[0].price

    if (hhPattern && hlPattern) trendUp = true
    else if (lhPattern && llPattern) trendUp = false
  }

  // Scan each candle for structure breaks
  for (let i = 1; i < candles.length; i++) {
    const candle = candles[i]

    // Find most recent swing high before this candle
    const priorHighs = swings.filter((s) => s.type === 'high' && s.index < i)
    const priorLows = swings.filter((s) => s.type === 'low' && s.index < i)

    if (priorHighs.length === 0 || priorLows.length === 0) continue

    const lastHigh = priorHighs[priorHighs.length - 1]
    const lastLow = priorLows[priorLows.length - 1]

    if (seenTimes.has(candle.time)) continue

    // Check for bullish break (close above last swing high)
    if (candle.close > lastHigh.price) {
      const type = trendUp === true ? 'BOS' : 'CHOCH'
      const direction = 'bullish'

      breaks.push({
        time: candle.time,
        type,
        direction,
        brokenLevel: lastHigh.price,
        candle,
      })
      seenTimes.add(candle.time)

      if (trendUp !== true) trendUp = true
      continue
    }

    // Check for bearish break (close below last swing low)
    if (candle.close < lastLow.price) {
      const type = trendUp === false ? 'BOS' : 'CHOCH'
      const direction = 'bearish'

      breaks.push({
        time: candle.time,
        type,
        direction,
        brokenLevel: lastLow.price,
        candle,
      })
      seenTimes.add(candle.time)

      if (trendUp !== false) trendUp = false
    }
  }

  return breaks
}

export function getMarketStructure(
  candles: Candle[],
  swings: SwingPoint[],
  breaks: StructureBreak[]
): MarketStructure {
  // Determine bias from last 2 swing highs and lows
  const swingHighs = swings.filter((s) => s.type === 'high').sort((a, b) => a.index - b.index)
  const swingLows = swings.filter((s) => s.type === 'low').sort((a, b) => a.index - b.index)

  let bias: MarketBias = 'ranging'

  if (swingHighs.length >= 2 && swingLows.length >= 2) {
    const lastTwoHighs = swingHighs.slice(-2)
    const lastTwoLows = swingLows.slice(-2)
    const hhPattern = lastTwoHighs[1].price > lastTwoHighs[0].price
    const hlPattern = lastTwoLows[1].price > lastTwoLows[0].price
    const lhPattern = lastTwoHighs[1].price < lastTwoHighs[0].price
    const llPattern = lastTwoLows[1].price < lastTwoLows[0].price

    if (hhPattern && hlPattern) bias = 'bullish'
    else if (lhPattern && llPattern) bias = 'bearish'
    else bias = 'ranging'
  }

  // Find lastBOS and lastCHOCH
  const sortedBreaks = [...breaks].sort((a, b) => b.time - a.time)
  const lastBOS = sortedBreaks.find((b) => b.type === 'BOS')
  const lastCHOCH = sortedBreaks.find((b) => b.type === 'CHOCH')

  // Calculate fib level: how far price has retraced from the last swing extreme
  const currentPrice = candles.length > 0 ? candles[candles.length - 1].close : 0
  let fibLevel = 0

  if (swingHighs.length > 0 && swingLows.length > 0) {
    const lastHigh = swingHighs[swingHighs.length - 1]
    const lastLow = swingLows[swingLows.length - 1]
    const range = lastHigh.price - lastLow.price

    if (range > 0) {
      if (bias === 'bullish') {
        // In bullish trend, measure retracement from last high
        fibLevel = ((lastHigh.price - currentPrice) / range) * 100
      } else if (bias === 'bearish') {
        // In bearish trend, measure retracement from last low
        fibLevel = ((currentPrice - lastLow.price) / range) * 100
      } else {
        // Ranging: measure position in range
        fibLevel = ((currentPrice - lastLow.price) / range) * 100
      }
    }
  }

  fibLevel = Math.max(0, Math.min(100, fibLevel))

  const currentLeg: 'impulse' | 'retracement' = fibLevel > 20 ? 'retracement' : 'impulse'

  return {
    bias,
    lastBOS,
    lastCHOCH,
    currentLeg,
    fibLevel,
  }
}
