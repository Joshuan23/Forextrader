import type { Candle } from '@/types/forex'
import type { SwingPoint, LiquidityLevel, LiquiditySweep } from '@/types/smc'
import { CURRENCY_PAIRS } from '@/lib/forex/pairs'

const EQUAL_LEVEL_TOLERANCE_PIPS = 3
const MIN_SWEEP_PIPS = 2

export function detectLiquidityLevels(
  candles: Candle[],
  swings: SwingPoint[],
  pair: string
): LiquidityLevel[] {
  const pairConfig = CURRENCY_PAIRS.find((p) => p.symbol === pair)
  const pipSize = pairConfig?.pipSize ?? 0.0001
  const tolerance = EQUAL_LEVEL_TOLERANCE_PIPS * pipSize

  const levels: LiquidityLevel[] = []

  // 1. Add all swing points as swing_high / swing_low levels
  for (const swing of swings) {
    // Check if this swing level has been swept by later candles
    const laterCandles = candles.filter((c) => c.time > swing.time)
    let swept = false
    let sweptTime: number | undefined

    for (const later of laterCandles) {
      if (swing.type === 'high' && later.high > swing.price) {
        swept = true
        sweptTime = later.time
        break
      } else if (swing.type === 'low' && later.low < swing.price) {
        swept = true
        sweptTime = later.time
        break
      }
    }

    levels.push({
      id: `liq-${swing.type === 'high' ? 'swing_high' : 'swing_low'}-${swing.time}`,
      time: swing.time,
      price: swing.price,
      type: swing.type === 'high' ? 'swing_high' : 'swing_low',
      swept,
      sweptTime,
      strength: swing.significance === 'major' ? 3 : 1,
    })
  }

  // 2. Detect equal highs: pairs of swing highs within tolerance
  const swingHighLevels = levels.filter((l) => l.type === 'swing_high')
  for (let i = 0; i < swingHighLevels.length; i++) {
    for (let j = i + 1; j < swingHighLevels.length; j++) {
      const diff = Math.abs(swingHighLevels[i].price - swingHighLevels[j].price)
      if (diff <= tolerance) {
        const avgPrice = (swingHighLevels[i].price + swingHighLevels[j].price) / 2
        const latestTime = Math.max(swingHighLevels[i].time, swingHighLevels[j].time)

        // Check if swept
        const laterCandles = candles.filter((c) => c.time > latestTime)
        let swept = false
        let sweptTime: number | undefined
        for (const later of laterCandles) {
          if (later.high > avgPrice) {
            swept = true
            sweptTime = later.time
            break
          }
        }

        levels.push({
          id: `liq-equal_highs-${latestTime}`,
          time: latestTime,
          price: avgPrice,
          type: 'equal_highs',
          swept,
          sweptTime,
          strength: 4,
        })
      }
    }
  }

  // 3. Detect equal lows: pairs of swing lows within tolerance
  const swingLowLevels = levels.filter((l) => l.type === 'swing_low')
  for (let i = 0; i < swingLowLevels.length; i++) {
    for (let j = i + 1; j < swingLowLevels.length; j++) {
      const diff = Math.abs(swingLowLevels[i].price - swingLowLevels[j].price)
      if (diff <= tolerance) {
        const avgPrice = (swingLowLevels[i].price + swingLowLevels[j].price) / 2
        const latestTime = Math.max(swingLowLevels[i].time, swingLowLevels[j].time)

        // Check if swept
        const laterCandles = candles.filter((c) => c.time > latestTime)
        let swept = false
        let sweptTime: number | undefined
        for (const later of laterCandles) {
          if (later.low < avgPrice) {
            swept = true
            sweptTime = later.time
            break
          }
        }

        levels.push({
          id: `liq-equal_lows-${latestTime}`,
          time: latestTime,
          price: avgPrice,
          type: 'equal_lows',
          swept,
          sweptTime,
          strength: 4,
        })
      }
    }
  }

  // Return last 20 sorted by time desc
  return levels.sort((a, b) => b.time - a.time).slice(0, 20)
}

export function detectLiquiditySweeps(
  candles: Candle[],
  levels: LiquidityLevel[],
  pair: string
): LiquiditySweep[] {
  const pairConfig = CURRENCY_PAIRS.find((p) => p.symbol === pair)
  const pipSize = pairConfig?.pipSize ?? 0.0001
  const minSweep = MIN_SWEEP_PIPS * pipSize

  const sweeps: LiquiditySweep[] = []

  for (const level of levels) {
    const laterCandles = candles.filter((c) => c.time > level.time)

    for (let i = 0; i < laterCandles.length; i++) {
      const candle = laterCandles[i]

      // HIGH SWEEP: wick above level, close below level
      if (
        candle.high > level.price + minSweep &&
        candle.close < level.price
      ) {
        const pipsSwept = (candle.high - level.price) / pipSize

        // Check reversal: any of next 4 candles closes below sweep candle body open (bullish reversal)
        const nextFour = laterCandles.slice(i + 1, i + 5)
        const reversed = nextFour.some((nc) => nc.close < candle.open)

        sweeps.push({
          time: candle.time,
          price: candle.high,
          type: 'high_sweep',
          pipsSwept,
          reversed,
          level,
        })
        break // only first sweep per level
      }

      // LOW SWEEP: wick below level, close above level
      if (
        candle.low < level.price - minSweep &&
        candle.close > level.price
      ) {
        const pipsSwept = (level.price - candle.low) / pipSize

        // Check reversal: any of next 4 candles closes above sweep candle body open (bearish reversal)
        const nextFour = laterCandles.slice(i + 1, i + 5)
        const reversed = nextFour.some((nc) => nc.close > candle.open)

        sweeps.push({
          time: candle.time,
          price: candle.low,
          type: 'low_sweep',
          pipsSwept,
          reversed,
          level,
        })
        break // only first sweep per level
      }
    }
  }

  // Return last 10 sorted by time desc
  return sweeps.sort((a, b) => b.time - a.time).slice(0, 10)
}

export function getTargetLiquidity(
  currentPrice: number,
  levels: LiquidityLevel[],
  direction: 'bullish' | 'bearish'
): LiquidityLevel[] {
  const unswept = levels.filter((l) => !l.swept)

  if (direction === 'bullish') {
    // Unswept swing_highs and equal_highs above currentPrice, nearest first
    return unswept
      .filter((l) => (l.type === 'swing_high' || l.type === 'equal_highs') && l.price > currentPrice)
      .sort((a, b) => a.price - b.price)
      .slice(0, 3)
  } else {
    // Unswept swing_lows and equal_lows below currentPrice, nearest first
    return unswept
      .filter((l) => (l.type === 'swing_low' || l.type === 'equal_lows') && l.price < currentPrice)
      .sort((a, b) => b.price - a.price)
      .slice(0, 3)
  }
}
