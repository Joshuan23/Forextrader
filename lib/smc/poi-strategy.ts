import type { Candle } from '@/types/forex'

// ── Extreme POI Mitigation strategy ──────────────────────────────────
// The exact SMC play from the chart:
//   1. LIQUIDITY SWEEP  — price runs a swing (buyside stop hunt above a high,
//      or sellside below a low) and closes back inside → engineered liquidity.
//   2. DISPLACEMENT     — the reaction leaves an origin zone: the EXTREME POI
//      (a bearish supply / bullish demand Order Block at the turn).
//   3. MITIGATION       — price returns INTO that POI. That touch is the entry.
//   4. TARGET           — the opposing liquidity pool ($$$): the swing low
//      (for shorts) / swing high (for longs) resting on the other side.
//   Stop sits just beyond the POI (past the sweep extreme).
//
// Deterministic & non-repainting: confirmed pivots, closed bars only. Returns
// the single most-recent ACTIONABLE play per pair (waiting to mitigate, or
// mitigating right now), or null with a reason.

export interface ExtremePoiOptions {
  pivotLen: number
  atrLen: number
  lookback: number   // how many recent bars to search for the play
  minRr: number      // floor for the liquidity target
}

export const DEFAULT_EXTREME_POI_OPTIONS: ExtremePoiOptions = {
  pivotLen: 5,
  atrLen: 14,
  lookback: 300,
  minRr: 1.5,
}

export interface ExtremePoiPlan {
  bias: 'bearish' | 'bullish'
  direction: 'long' | 'short'
  sweepType: 'buyside' | 'sellside'
  sweepLevel: number      // the liquidity that got hunted
  sweepTime: number
  poiKind: 'OrderBlock'
  poiTop: number
  poiBottom: number
  state: 'waiting' | 'mitigating' // returning to the zone, or inside it now
  entry: number           // proximal edge of the POI (first touch)
  stopLoss: number        // beyond the POI / sweep extreme
  takeProfit: number      // opposing liquidity ($$$) or minRR
  riskReward: number
  targetIsLiquidity: boolean
  distancePips: number    // from current price to the entry edge
}

export interface ExtremePoiState {
  lastClose: number
  lastTime: number
  atr: number
  plan: ExtremePoiPlan | null
  reason?: string
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

// A confirmed pivot at bar i (needs p bars either side that don't exceed it).
function isPivotHigh(c: Candle[], i: number, p: number): boolean {
  for (let k = i - p; k <= i + p; k++) {
    if (k === i || k < 0 || k >= c.length) continue
    if (c[k].high >= c[i].high) return false
  }
  return true
}
function isPivotLow(c: Candle[], i: number, p: number): boolean {
  for (let k = i - p; k <= i + p; k++) {
    if (k === i || k < 0 || k >= c.length) continue
    if (c[k].low <= c[i].low) return false
  }
  return true
}

export function analyzeExtremePoi(
  candles: Candle[],
  pip: number,
  opts: Partial<ExtremePoiOptions> = {}
): ExtremePoiState {
  const o: ExtremePoiOptions = { ...DEFAULT_EXTREME_POI_OPTIONS, ...opts }
  const n = candles.length
  const last = candles[n - 1]
  const atr = atrSeries(candles, o.atrLen)
  const base: ExtremePoiState = {
    lastClose: last?.close ?? 0,
    lastTime: last?.time ?? 0,
    atr: atr[n - 1] ?? 0,
    plan: null,
  }
  if (n < 60) return { ...base, reason: 'insufficient_data' }

  const p = o.pivotLen
  // Confirmed swing pools (a pivot at i is only known at i + p).
  const swingHighs: { price: number; idx: number }[] = []
  const swingLows: { price: number; idx: number }[] = []
  for (let i = p; i < n - p; i++) {
    if (isPivotHigh(candles, i, p)) swingHighs.push({ price: candles[i].high, idx: i })
    if (isPivotLow(candles, i, p)) swingLows.push({ price: candles[i].low, idx: i })
  }

  const buf = (i: number) => 0.15 * (Number.isNaN(atr[i]) ? (last.high - last.low) : atr[i])
  const start = Math.max(p + 1, n - o.lookback)

  // Search newest → oldest for the most recent actionable sweep + POI.
  for (let i = n - 1; i >= start; i--) {
    const bar = candles[i]

    // Most recent confirmed swing strictly before this bar.
    const priorHigh = [...swingHighs].reverse().find((s) => s.idx + p < i)
    const priorLow = [...swingLows].reverse().find((s) => s.idx + p < i)

    // ── Buyside stop hunt → bearish supply play ──
    if (priorHigh && bar.high > priorHigh.price && bar.close < priorHigh.price) {
      // Extreme POI = last up-candle in the sweep window (bearish Order Block).
      let ob = -1
      for (let j = i; j >= Math.max(0, i - 3); j--) {
        if (candles[j].close > candles[j].open) { ob = j; break }
      }
      if (ob >= 0) {
        const top = Math.max(candles[ob].high, bar.high) // include the wick that ran liquidity
        const bottom = candles[ob].open                  // body base = proximal edge
        const entry = bottom
        const stop = top + buf(i)
        const risk = stop - entry
        // Target = sell-side liquidity: nearest swing-low pool that clears
        // minRR; if none is deep enough, fall back to the minRR floor.
        const rrFloorTgt = entry - o.minRr * risk
        const poolLow = [...swingLows].reverse().find((s) => s.price <= rrFloorTgt)
        const target = poolLow ? poolLow.price : rrFloorTgt
        if (risk > 0 && target < entry) {
          const invalidated = last.close > stop
          if (!invalidated) {
            const state: ExtremePoiPlan['state'] = last.close <= top && last.close >= bottom ? 'mitigating' : 'waiting'
            // Only actionable while price hasn't already blown past the target.
            if (last.close > target) {
              return {
                ...base,
                plan: {
                  bias: 'bearish', direction: 'short', sweepType: 'buyside',
                  sweepLevel: priorHigh.price, sweepTime: bar.time, poiKind: 'OrderBlock',
                  poiTop: top, poiBottom: bottom, state,
                  entry, stopLoss: stop, takeProfit: target,
                  riskReward: Math.round(((entry - target) / risk) * 100) / 100,
                  targetIsLiquidity: !!poolLow,
                  distancePips: Math.round((Math.abs(last.close - entry) / pip) * 10) / 10,
                },
              }
            }
          }
        }
      }
    }

    // ── Sellside stop hunt → bullish demand play ──
    if (priorLow && bar.low < priorLow.price && bar.close > priorLow.price) {
      let ob = -1
      for (let j = i; j >= Math.max(0, i - 3); j--) {
        if (candles[j].close < candles[j].open) { ob = j; break }
      }
      if (ob >= 0) {
        const bottom = Math.min(candles[ob].low, bar.low)
        const top = candles[ob].open
        const entry = top
        const stop = bottom - buf(i)
        const risk = entry - stop
        const rrFloorTgt = entry + o.minRr * risk
        const poolHigh = [...swingHighs].reverse().find((s) => s.price >= rrFloorTgt)
        const target = poolHigh ? poolHigh.price : rrFloorTgt
        if (risk > 0 && target > entry) {
          const invalidated = last.close < stop
          if (!invalidated && last.close < target) {
            const state: ExtremePoiPlan['state'] = last.close >= bottom && last.close <= top ? 'mitigating' : 'waiting'
            return {
              ...base,
              plan: {
                bias: 'bullish', direction: 'long', sweepType: 'sellside',
                sweepLevel: priorLow.price, sweepTime: bar.time, poiKind: 'OrderBlock',
                poiTop: top, poiBottom: bottom, state,
                entry, stopLoss: stop, takeProfit: target,
                riskReward: Math.round(((target - entry) / risk) * 100) / 100,
                targetIsLiquidity: !!poolHigh,
                distancePips: Math.round((Math.abs(last.close - entry) / pip) * 10) / 10,
              },
            }
          }
        }
      }
    }
  }

  return { ...base, reason: 'no_actionable_sweep' }
}
