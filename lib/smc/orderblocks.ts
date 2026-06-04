import type { Candle } from '@/types/forex'
import type { OrderBlock } from '@/types/smc'
import { CURRENCY_PAIRS } from '@/lib/forex/pairs'

const MIN_IMPULSE_MULTIPLIER = 2.5

function avgRange(candles: Candle[], lookback?: number): number {
  const n = lookback ?? candles.length
  const slice = candles.slice(-n)
  if (slice.length === 0) return 0
  const total = slice.reduce((sum, c) => sum + (c.high - c.low), 0)
  return total / slice.length
}

export function detectOrderBlocks(candles: Candle[], pair: string): OrderBlock[] {
  const pairConfig = CURRENCY_PAIRS.find((p) => p.symbol === pair)
  const blocks: OrderBlock[] = []

  const avg = avgRange(candles, 20)

  for (let i = 2; i < candles.length - 3; i++) {
    const candle = candles[i]

    // Calculate impulse from the next 3 candles
    const nextCandles = candles.slice(i + 1, i + 4)
    if (nextCandles.length < 3) continue

    const impulseHigh = Math.max(...nextCandles.map((c) => c.high))
    const impulseLow = Math.min(...nextCandles.map((c) => c.low))
    const impulseSize = impulseHigh - impulseLow

    // BEARISH OB: current candle is bullish, next 3 have strong bearish move
    const isBullishCandle = candle.close > candle.open
    const bearishMove = nextCandles[nextCandles.length - 1].close < nextCandles[0].open
      ? nextCandles[0].open - nextCandles[nextCandles.length - 1].close
      : 0

    if (isBullishCandle && bearishMove > MIN_IMPULSE_MULTIPLIER * avg) {
      // Check if mitigated by later candles
      const laterCandles = candles.slice(i + 4)
      let mitigated = false
      let mitigation = 0

      for (const later of laterCandles) {
        if (later.low <= candle.high && later.high >= candle.low) {
          mitigated = true
          mitigation = later.time
          break
        }
      }

      const strength: 'strong' | 'medium' | 'weak' =
        bearishMove > MIN_IMPULSE_MULTIPLIER * avg * 2
          ? 'strong'
          : bearishMove > MIN_IMPULSE_MULTIPLIER * avg * 1.5
          ? 'medium'
          : 'weak'

      const digits = pairConfig?.digits ?? 5
      blocks.push({
        id: `ob-bearish-${candle.time}`,
        time: candle.time,
        open: parseFloat(candle.open.toFixed(digits)),
        high: parseFloat(candle.high.toFixed(digits)),
        low: parseFloat(candle.low.toFixed(digits)),
        close: parseFloat(candle.close.toFixed(digits)),
        type: 'bearish',
        mitigated,
        mitigation,
        strength,
        impulseSize,
      })
    }

    // BULLISH OB: current candle is bearish, next 3 have strong bullish move
    const isBearishCandle = candle.close < candle.open
    const bullishMove = nextCandles[nextCandles.length - 1].close > nextCandles[0].open
      ? nextCandles[nextCandles.length - 1].close - nextCandles[0].open
      : 0

    if (isBearishCandle && bullishMove > MIN_IMPULSE_MULTIPLIER * avg) {
      // Check if mitigated by later candles
      const laterCandles = candles.slice(i + 4)
      let mitigated = false
      let mitigation = 0

      for (const later of laterCandles) {
        if (later.low <= candle.high && later.high >= candle.low) {
          mitigated = true
          mitigation = later.time
          break
        }
      }

      const strength: 'strong' | 'medium' | 'weak' =
        bullishMove > MIN_IMPULSE_MULTIPLIER * avg * 2
          ? 'strong'
          : bullishMove > MIN_IMPULSE_MULTIPLIER * avg * 1.5
          ? 'medium'
          : 'weak'

      const digits = pairConfig?.digits ?? 5
      blocks.push({
        id: `ob-bullish-${candle.time}`,
        time: candle.time,
        open: parseFloat(candle.open.toFixed(digits)),
        high: parseFloat(candle.high.toFixed(digits)),
        low: parseFloat(candle.low.toFixed(digits)),
        close: parseFloat(candle.close.toFixed(digits)),
        type: 'bullish',
        mitigated,
        mitigation,
        strength,
        impulseSize,
      })
    }
  }

  // Return last 15 blocks sorted by time desc
  return blocks.sort((a, b) => b.time - a.time).slice(0, 15)
}

export function findNearestOrderBlock(
  currentPrice: number,
  blocks: OrderBlock[],
  direction: 'bullish' | 'bearish',
  pipSize: number
): OrderBlock | null {
  const unmitigated = blocks.filter((b) => !b.mitigated && b.type === direction)

  if (direction === 'bullish') {
    // Find nearest unmitigated bullish OB below currentPrice (highest .high first)
    const below = unmitigated.filter((b) => b.high < currentPrice)
    if (below.length === 0) return null
    return below.sort((a, b) => b.high - a.high)[0]
  } else {
    // Find nearest unmitigated bearish OB above currentPrice (lowest .low first)
    const above = unmitigated.filter((b) => b.low > currentPrice)
    if (above.length === 0) return null
    return above.sort((a, b) => a.low - b.low)[0]
  }
}
