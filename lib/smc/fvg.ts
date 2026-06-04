import type { Candle } from '@/types/forex'
import type { FairValueGap } from '@/types/smc'
import { CURRENCY_PAIRS } from '@/lib/forex/pairs'

const MIN_FVG_PIPS = 3

export function detectFairValueGaps(candles: Candle[], pair: string): FairValueGap[] {
  const pairConfig = CURRENCY_PAIRS.find((p) => p.symbol === pair)
  const pipSize = pairConfig?.pipSize ?? 0.0001
  const digits = pairConfig?.digits ?? 5
  const fvgs: FairValueGap[] = []

  for (let i = 1; i < candles.length - 1; i++) {
    const prev = candles[i - 1]  // C1
    // const curr = candles[i]    // C2 (middle candle, creates the gap)
    const next = candles[i + 1]  // C3

    // BULLISH FVG: C3.low > C1.high
    if (next.low > prev.high) {
      const top = next.low
      const bottom = prev.high
      const gapSize = top - bottom
      const gapPips = gapSize / pipSize

      if (gapPips >= MIN_FVG_PIPS) {
        // Track fill: has any later candle penetrated the gap?
        const laterCandles = candles.slice(i + 2)
        let filled = false
        let fillPercent = 0

        for (const later of laterCandles) {
          if (later.low <= bottom) {
            filled = true
            fillPercent = 100
            break
          } else if (later.low < top) {
            const penetration = top - later.low
            fillPercent = Math.min(100, (penetration / gapSize) * 100)
          }
        }

        const mid = parseFloat(((top + bottom) / 2).toFixed(digits))
        fvgs.push({
          id: `fvg-bullish-${candles[i].time}`,
          time: candles[i].time,
          top: parseFloat(top.toFixed(digits)),
          bottom: parseFloat(bottom.toFixed(digits)),
          mid,
          type: 'bullish',
          filled,
          fillPercent,
          sizeInPips: gapPips,
        })
      }
    }

    // BEARISH FVG: C3.high < C1.low
    if (next.high < prev.low) {
      const top = prev.low
      const bottom = next.high
      const gapSize = top - bottom
      const gapPips = gapSize / pipSize

      if (gapPips >= MIN_FVG_PIPS) {
        // Track fill: has any later candle penetrated the gap?
        const laterCandles = candles.slice(i + 2)
        let filled = false
        let fillPercent = 0

        for (const later of laterCandles) {
          if (later.high >= top) {
            filled = true
            fillPercent = 100
            break
          } else if (later.high > bottom) {
            const penetration = later.high - bottom
            fillPercent = Math.min(100, (penetration / gapSize) * 100)
          }
        }

        const mid = parseFloat(((top + bottom) / 2).toFixed(digits))
        fvgs.push({
          id: `fvg-bearish-${candles[i].time}`,
          time: candles[i].time,
          top: parseFloat(top.toFixed(digits)),
          bottom: parseFloat(bottom.toFixed(digits)),
          mid,
          type: 'bearish',
          filled,
          fillPercent,
          sizeInPips: gapPips,
        })
      }
    }
  }

  // Return last 12 sorted by time desc
  return fvgs.sort((a, b) => b.time - a.time).slice(0, 12)
}

export function findNearestFVG(
  currentPrice: number,
  fvgs: FairValueGap[],
  direction: 'bullish' | 'bearish'
): FairValueGap | null {
  const unfilled = fvgs.filter((f) => !f.filled && f.type === direction)

  if (direction === 'bullish') {
    // Unfilled bullish FVG below currentPrice (highest .top first)
    const below = unfilled.filter((f) => f.top < currentPrice)
    if (below.length === 0) return null
    return below.sort((a, b) => b.top - a.top)[0]
  } else {
    // Unfilled bearish FVG above currentPrice (lowest .bottom first)
    const above = unfilled.filter((f) => f.bottom > currentPrice)
    if (above.length === 0) return null
    return above.sort((a, b) => a.bottom - b.bottom)[0]
  }
}
