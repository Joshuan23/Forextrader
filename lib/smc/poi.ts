import type { Candle } from '@/types/forex'

// Point-of-Interest detector (SMC/ICT): finds the UNMITIGATED zones price is
// likely to react from — Fair Value Gaps and Order Blocks — and turns each
// into a limit-entry plan (enter at the zone edge, stop beyond it, target
// opposing liquidity or min R:R). Deterministic and non-repainting: every
// POI is confirmed on closed bars and only kept while price has not yet
// traded back into it.

export interface PoiOptions {
  lookback: number       // how many recent bars to scan
  atrLen: number
  displacementAtr: number // OB requires an impulse ≥ this × ATR
  minRr: number
  maxPois: number
}

export const DEFAULT_POI_OPTIONS: PoiOptions = {
  lookback: 300,
  atrLen: 14,
  displacementAtr: 1.5,
  minRr: 2,
  maxPois: 8,
}

export interface Poi {
  kind: 'FVG' | 'OrderBlock'
  direction: 'long' | 'short'
  top: number            // upper edge of the zone
  bottom: number         // lower edge of the zone
  entry: number          // proximal edge (first touch)
  stopLoss: number       // beyond the distal edge
  takeProfit: number     // opposing liquidity or min R:R
  riskReward: number
  formedAt: number       // bar time the zone formed
  distancePips: number   // from current price to the entry edge
}

function rma(values: number[], len: number): number[] {
  const out = new Array<number>(values.length).fill(NaN)
  let r = NaN, seed = 0
  for (let i = 0; i < values.length; i++) {
    if (i < len - 1) { seed += values[i]; continue }
    if (i === len - 1) r = (seed + values[i]) / len
    else r = (values[i] + (len - 1) * r) / len
    out[i] = r
  }
  return out
}

function atrSeries(c: Candle[], len: number): number[] {
  const tr = c.map((k, i) =>
    i === 0 ? k.high - k.low : Math.max(k.high - k.low, Math.abs(k.high - c[i - 1].close), Math.abs(k.low - c[i - 1].close))
  )
  return rma(tr, len)
}

export function detectPois(candles: Candle[], pip: number, opts: Partial<PoiOptions> = {}): Poi[] {
  const o: PoiOptions = { ...DEFAULT_POI_OPTIONS, ...opts }
  const n = candles.length
  if (n < 30) return []
  const atr = atrSeries(candles, o.atrLen)
  const last = candles[n - 1]
  const start = Math.max(2, n - o.lookback)

  // Swing extremes (3-bar pivots) for target selection.
  const swingHighs: number[] = []
  const swingLows: number[] = []
  for (let i = 3; i < n - 3; i++) {
    let ph = true, pl = true
    for (let k = i - 3; k <= i + 3; k++) {
      if (k === i) continue
      if (candles[k].high >= candles[i].high) ph = false
      if (candles[k].low <= candles[i].low) pl = false
    }
    if (ph) swingHighs.push(candles[i].high)
    if (pl) swingLows.push(candles[i].low)
  }
  const nearestAbove = (price: number) => swingHighs.filter((h) => h > price).sort((a, b) => a - b)[0]
  const nearestBelow = (price: number) => swingLows.filter((l) => l < price).sort((a, b) => b - a)[0]

  const raw: Omit<Poi, 'entry' | 'stopLoss' | 'takeProfit' | 'riskReward' | 'distancePips'>[] = []

  for (let i = start; i < n; i++) {
    // ── Fair Value Gap (3-candle imbalance) ──
    if (i >= 2) {
      if (candles[i].low > candles[i - 2].high) {
        raw.push({ kind: 'FVG', direction: 'long', top: candles[i].low, bottom: candles[i - 2].high, formedAt: candles[i].time })
      }
      if (candles[i].high < candles[i - 2].low) {
        raw.push({ kind: 'FVG', direction: 'short', top: candles[i - 2].low, bottom: candles[i].high, formedAt: candles[i].time })
      }
    }
    // ── Order Block (last opposite candle before a displacement impulse) ──
    if (!Number.isNaN(atr[i])) {
      const range = candles[i].high - candles[i].low
      const body = Math.abs(candles[i].close - candles[i].open)
      const impulse = range >= o.displacementAtr * atr[i] && body >= 0.5 * range
      if (impulse) {
        if (candles[i].close > candles[i].open) {
          for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
            if (candles[j].close < candles[j].open) {
              raw.push({ kind: 'OrderBlock', direction: 'long', top: candles[j].high, bottom: candles[j].low, formedAt: candles[j].time })
              break
            }
          }
        } else if (candles[i].close < candles[i].open) {
          for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
            if (candles[j].close > candles[j].open) {
              raw.push({ kind: 'OrderBlock', direction: 'short', top: candles[j].high, bottom: candles[j].low, formedAt: candles[j].time })
              break
            }
          }
        }
      }
    }
  }

  // Keep only UNMITIGATED zones: price has not traded back into the zone
  // after it formed, and the zone still sits on the correct side of price.
  const pois: Poi[] = []
  for (const z of raw) {
    const formedIdx = candles.findIndex((c) => c.time === z.formedAt)
    if (formedIdx < 0) continue
    let mitigated = false
    for (let k = formedIdx + 1; k < n; k++) {
      const overlap = candles[k].low <= z.top && candles[k].high >= z.bottom
      if (overlap) { mitigated = true; break }
    }
    if (mitigated) continue
    // Zone must still be ahead of price in its direction (a fresh POI).
    if (z.direction === 'long' && z.top >= last.close) continue
    if (z.direction === 'short' && z.bottom <= last.close) continue

    const buffer = 0.2 * (Number.isNaN(atr[n - 1]) ? (z.top - z.bottom) : atr[n - 1])
    let entry: number, stop: number, target: number
    if (z.direction === 'long') {
      entry = z.top // proximal edge — price drops into the zone
      stop = z.bottom - buffer
      const risk = entry - stop
      const swing = nearestAbove(entry)
      target = swing && swing > entry + o.minRr * risk ? swing : entry + o.minRr * risk
      pois.push({ ...z, entry, stopLoss: stop, takeProfit: target, riskReward: risk > 0 ? Math.round(((target - entry) / risk) * 100) / 100 : 0, distancePips: Math.round((Math.abs(last.close - entry) / pip) * 10) / 10 })
    } else {
      entry = z.bottom
      stop = z.top + buffer
      const risk = stop - entry
      const swing = nearestBelow(entry)
      target = swing && swing < entry - o.minRr * risk ? swing : entry - o.minRr * risk
      pois.push({ ...z, entry, stopLoss: stop, takeProfit: target, riskReward: risk > 0 ? Math.round(((entry - target) / risk) * 100) / 100 : 0, distancePips: Math.round((Math.abs(last.close - entry) / pip) * 10) / 10 })
    }
  }

  // Nearest to price first; cap the list.
  return pois.sort((a, b) => a.distancePips - b.distancePips).slice(0, o.maxPois)
}
