import type { Candle } from '@/types/forex'

// ICT backtest engine — a faithful TypeScript replay of
// pine/flowedge-ict-feeder.pine over historical candles, so the exact
// strategy that fires webhooks can be measured (win rate, expectancy,
// profit factor) per confluence level BEFORE trusting it with money.
//
// Faithfulness notes (mirrors the Pine bar-by-bar semantics):
//   · pivots confirm pivotLen bars late and never revise
//   · ATR/RSI use Wilder smoothing (Pine ta.atr / ta.rsi), EMA standard
//   · HTF bias = prior CLOSED hourly bar vs its EMA50 (no lookahead)
//   · sweep arms → MSS close confirms → confluence gate → one trade,
//     then cooldown; same state machine, same disarm rules
//   · stop = swept extreme ∓ 0.1×ATR; target = prior swing if ≥ minRR,
//     else minRR
// Simulation: entry at the MSS bar close. On a later bar hitting both
// stop and target, the STOP wins (conservative — cannot know intrabar
// order). Trades still open after maxHoldBars exit at that bar's close.

export interface IctBacktestOptions {
  pivotLen: number      // swing pivot bars (left/right)
  atrLen: number
  minRr: number         // minimum reward:risk target
  cooldown: number      // bars between entries
  requireFvg: boolean
  useHtfBias: boolean
  minConfl: number      // 1..5 confluences required
  killOnly: boolean     // London/NY kill zones only
  maxHoldBars: number   // force-exit horizon
  session: 'london' | 'newyork' | 'both' // restrict to one kill zone
  partialTp: boolean    // bank half at 1R, move stop to breakeven, run the rest
  spreadPrice: number   // round-trip transaction cost in PRICE units (e.g. gold $0.35);
                        // deducted from every trade's R so results are NET, not gross.
                        // 0 = frictionless (old behaviour). Matters most where the spread
                        // is large relative to ICT's tight sweep stops (metals, indices).
  fixedStopPrice: number // if >0, override the structure stop with a FIXED distance in
                         // price units (entry ∓ this). 0 = ICT sweep-based stop.
  fixedTpPrice: number   // if >0, override the target with a FIXED distance in price
                         // units (entry ± this). 0 = structure/minRR target.
  // maxHoldBars <= 0 means NO timeout: hold each trade until stop or target
  // resolves it (or data runs out). Kills the "timeout" bucket entirely.
}

export const DEFAULT_ICT_OPTIONS: IctBacktestOptions = {
  pivotLen: 5,
  atrLen: 14,
  minRr: 2,
  cooldown: 20,
  requireFvg: true,
  useHtfBias: true,
  minConfl: 3,
  killOnly: true,
  maxHoldBars: 96,
  session: 'both',
  partialTp: false,
  spreadPrice: 0,
  fixedStopPrice: 0,
  fixedTpPrice: 0,
}

export interface BacktestTrade {
  entryTime: number
  exitTime: number
  direction: 'long' | 'short'
  entry: number
  stop: number
  target: number
  confluenceScore: number
  confirmations: string[]
  session: 'london' | 'newyork' | 'other'
  outcome: 'win' | 'partial' | 'loss' | 'timeout'
  rMultiple: number
  holdBars: number
}

export interface BacktestBucket {
  trades: number
  wins: number
  losses: number
  timeouts: number
  winRate: number       // wins / (wins + losses); timeouts excluded
  avgR: number          // mean R over all trades incl. timeouts
  expectancyR: number   // same as avgR (kept explicit for the UI)
  profitFactor: number  // gross win R / gross loss R
}

export interface IctBacktestResult {
  bars: number
  firstBarTime: number
  lastBarTime: number
  options: IctBacktestOptions
  overall: BacktestBucket
  byConfluence: Record<string, BacktestBucket>
  bySession: Record<string, BacktestBucket>
  byConfirmation: Record<string, BacktestBucket> // edge of each individual confluence
  byDirection: Record<string, BacktestBucket>
  maxDrawdownR: number
  trades: BacktestTrade[]
}

// ── Indicator helpers (Pine-equivalent smoothing) ────────────────────

function emaSeries(values: number[], len: number): number[] {
  const k = 2 / (len + 1)
  const out = new Array<number>(values.length).fill(NaN)
  let ema = NaN
  let seedSum = 0
  for (let i = 0; i < values.length; i++) {
    if (i < len - 1) {
      seedSum += values[i]
      continue
    }
    if (i === len - 1) {
      ema = (seedSum + values[i]) / len // SMA seed, Pine-style
    } else {
      ema = values[i] * k + ema * (1 - k)
    }
    out[i] = ema
  }
  return out
}

function rmaSeries(values: number[], len: number): number[] {
  const out = new Array<number>(values.length).fill(NaN)
  let rma = NaN
  let seedSum = 0
  for (let i = 0; i < values.length; i++) {
    if (i < len - 1) {
      seedSum += values[i]
      continue
    }
    if (i === len - 1) rma = (seedSum + values[i]) / len
    else rma = (values[i] + (len - 1) * rma) / len
    out[i] = rma
  }
  return out
}

function atrSeries(candles: Candle[], len: number): number[] {
  const tr = candles.map((c, i) =>
    i === 0
      ? c.high - c.low
      : Math.max(c.high - c.low, Math.abs(c.high - candles[i - 1].close), Math.abs(c.low - candles[i - 1].close))
  )
  return rmaSeries(tr, len)
}

function rsiSeries(closes: number[], len: number): number[] {
  const gains = closes.map((c, i) => (i === 0 ? 0 : Math.max(0, c - closes[i - 1])))
  const losses = closes.map((c, i) => (i === 0 ? 0 : Math.max(0, closes[i - 1] - c)))
  const avgG = rmaSeries(gains, len)
  const avgL = rmaSeries(losses, len)
  return closes.map((_, i) => {
    if (Number.isNaN(avgG[i]) || Number.isNaN(avgL[i])) return NaN
    if (avgL[i] === 0) return 100
    return 100 - 100 / (1 + avgG[i] / avgL[i])
  })
}

// HTF bias per bar: sign of (prior closed 1h bucket close − its EMA50).
// Uses only hourly buckets that closed strictly before the bar's bucket.
function htfBiasSeries(candles: Candle[]): number[] {
  const HOUR = 3_600_000
  const out = new Array<number>(candles.length).fill(0)
  const hourlyCloses: number[] = []
  let bucket = -1
  let ema = NaN
  let prevRel = 0 // sign for the current bucket, from data before it
  const K = 2 / 51
  for (let i = 0; i < candles.length; i++) {
    const b = Math.floor(candles[i].time / HOUR)
    if (b !== bucket) {
      // previous bucket just closed — fold its close into the EMA
      if (bucket !== -1) {
        const closed = candles[i - 1].close
        hourlyCloses.push(closed)
        if (hourlyCloses.length === 50) ema = hourlyCloses.reduce((a, v) => a + v, 0) / 50
        else if (hourlyCloses.length > 50) ema = closed * K + ema * (1 - K)
        prevRel = Number.isNaN(ema) ? 0 : Math.sign(closed - ema)
      }
      bucket = b
    }
    out[i] = prevRel
  }
  return out
}

function sessionOf(timeMs: number): 'london' | 'newyork' | null {
  const h = new Date(timeMs).getUTCHours()
  if (h >= 7 && h < 10) return 'london'
  if (h >= 12 && h < 15) return 'newyork'
  return null
}

export function bucketStats(trades: BacktestTrade[]): BacktestBucket {
  // A partial (banked 1R then stopped at breakeven) is a positive-outcome win.
  const wins = trades.filter((t) => t.outcome === 'win' || t.outcome === 'partial').length
  const losses = trades.filter((t) => t.outcome === 'loss').length
  const timeouts = trades.filter((t) => t.outcome === 'timeout').length
  const grossWin = trades.filter((t) => t.rMultiple > 0).reduce((a, t) => a + t.rMultiple, 0)
  const grossLoss = Math.abs(trades.filter((t) => t.rMultiple < 0).reduce((a, t) => a + t.rMultiple, 0))
  const avgR = trades.length ? trades.reduce((a, t) => a + t.rMultiple, 0) / trades.length : 0
  return {
    trades: trades.length,
    wins,
    losses,
    timeouts,
    winRate: wins + losses > 0 ? wins / (wins + losses) : 0,
    avgR,
    expectancyR: avgR,
    // 999 stands in for "no losing trades yet" — Infinity would serialize to null in JSON.
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? 999 : 0,
  }
}

// ── Entry generation (shared by the backtester and the live scanner) ─

export interface IctEntryDetail {
  barIndex: number
  time: number
  direction: 'long' | 'short'
  entry: number
  stop: number
  target: number
  confluenceScore: number
  confirmations: string[]
  session: 'london' | 'newyork' | 'other'
  // Chart context at the entry bar (for downstream scoring/audit)
  close: number
  high: number
  low: number
  atr: number
  emaFast: number
  emaSlow: number
  rsi: number
  swingHigh: number
  swingLow: number
  triggerLevel: number
}

export function generateIctEntries(candles: Candle[], opts: Partial<IctBacktestOptions> = {}): IctEntryDetail[] {
  const o: IctBacktestOptions = { ...DEFAULT_ICT_OPTIONS, ...opts }
  const n = candles.length
  const closes = candles.map((c) => c.close)
  const atr = atrSeries(candles, o.atrLen)
  const rsi = rsiSeries(closes, 14)
  const htf = htfBiasSeries(candles)
  const ema21 = emaSeries(closes, 21)
  const ema50 = emaSeries(closes, 50)

  // State (mirrors the Pine vars)
  let lastSwingHigh = NaN, prevSwingHigh = NaN
  let lastSwingLow = NaN, prevSwingLow = NaN
  let armedLong = false, sweepLow = NaN, mssHighTgt = NaN
  let armedShort = false, sweepHigh = NaN, mssLowTgt = NaN
  let lastEntryBar = -1_000_000

  const entries: IctEntryDetail[] = []

  const p = o.pivotLen
  for (let i = 0; i < n; i++) {
    // 1. Pivot confirmation (pivot at i−p confirms on bar i)
    const c0 = i - p
    if (c0 >= p) {
      let isPh = true, isPl = true
      for (let k = c0 - p; k <= c0 + p; k++) {
        if (k === c0) continue
        if (candles[k].high >= candles[c0].high) isPh = false
        if (candles[k].low <= candles[c0].low) isPl = false
        if (!isPh && !isPl) break
      }
      if (isPh) { prevSwingHigh = lastSwingHigh; lastSwingHigh = candles[c0].high }
      if (isPl) { prevSwingLow = lastSwingLow; lastSwingLow = candles[c0].low }
    }

    const bar = candles[i]

    // 2. Sweep detection / arming
    if (!Number.isNaN(lastSwingLow) && bar.low < lastSwingLow && bar.close > lastSwingLow) {
      armedLong = true; sweepLow = bar.low; mssHighTgt = lastSwingHigh
    }
    if (!Number.isNaN(lastSwingHigh) && bar.high > lastSwingHigh && bar.close < lastSwingHigh) {
      armedShort = true; sweepHigh = bar.high; mssLowTgt = lastSwingLow
    }
    if (armedLong && bar.close < sweepLow) armedLong = false
    if (armedShort && bar.close > sweepHigh) armedShort = false

    // 3. Entry gate
    const session = sessionOf(bar.time)
    if ((o.killOnly && !session) || i - lastEntryBar < o.cooldown || Number.isNaN(atr[i])) continue

    const barRange = bar.high - bar.low
    const displacement = barRange >= 1.2 * atr[i] && Math.abs(bar.close - bar.open) >= 0.5 * barRange
    const bullFvg = i >= 2 && bar.low > candles[i - 2].high
    const bearFvg = i >= 2 && bar.high < candles[i - 2].low

    let dir: 'long' | 'short' | null = null
    let entry = NaN, stop = NaN, target = NaN
    let confs: string[] = []

    if (armedLong && !Number.isNaN(mssHighTgt) && bar.close > mssHighTgt) {
      const eq = (mssHighTgt + sweepLow) / 2
      const checks: [string, boolean][] = [
        ['fvg', bullFvg], ['htf', htf[i] > 0], ['displacement', displacement],
        ['rsi', !Number.isNaN(rsi[i]) && rsi[i] > 50], ['discount', bar.close <= eq],
      ]
      confs = checks.filter(([, ok]) => ok).map(([name]) => name)
      const gate = confs.length >= o.minConfl && (!o.requireFvg || bullFvg) && (!o.useHtfBias || htf[i] > 0)
      if (gate) {
        dir = 'long'
        entry = bar.close
        stop = o.fixedStopPrice > 0 ? entry - o.fixedStopPrice : sweepLow - 0.1 * atr[i]
        const risk = entry - stop
        target = o.fixedTpPrice > 0
          ? entry + o.fixedTpPrice
          : !Number.isNaN(prevSwingHigh) && prevSwingHigh > entry + o.minRr * risk ? prevSwingHigh : entry + o.minRr * risk
        armedLong = false
      }
    } else if (armedShort && !Number.isNaN(mssLowTgt) && bar.close < mssLowTgt) {
      const eq = (sweepHigh + mssLowTgt) / 2
      const checks: [string, boolean][] = [
        ['fvg', bearFvg], ['htf', htf[i] < 0], ['displacement', displacement],
        ['rsi', !Number.isNaN(rsi[i]) && rsi[i] < 50], ['premium', bar.close >= eq],
      ]
      confs = checks.filter(([, ok]) => ok).map(([name]) => name)
      const gate = confs.length >= o.minConfl && (!o.requireFvg || bearFvg) && (!o.useHtfBias || htf[i] < 0)
      if (gate) {
        dir = 'short'
        entry = bar.close
        stop = o.fixedStopPrice > 0 ? entry + o.fixedStopPrice : sweepHigh + 0.1 * atr[i]
        const risk = stop - entry
        target = o.fixedTpPrice > 0
          ? entry - o.fixedTpPrice
          : !Number.isNaN(prevSwingLow) && prevSwingLow < entry - o.minRr * risk ? prevSwingLow : entry - o.minRr * risk
        armedShort = false
      }
    }
    if (!dir) continue
    const sessionLabel: BacktestTrade['session'] = session ?? 'other'
    // Session restriction (data showed London >> New York)
    if (o.session !== 'both' && sessionLabel !== o.session) continue

    entries.push({
      barIndex: i, time: bar.time, direction: dir, entry, stop, target,
      confluenceScore: confs.length, confirmations: confs, session: sessionLabel,
      close: bar.close, high: bar.high, low: bar.low,
      atr: atr[i], emaFast: ema21[i], emaSlow: ema50[i],
      rsi: Number.isNaN(rsi[i]) ? 50 : rsi[i],
      swingHigh: Number.isNaN(lastSwingHigh) ? bar.high : lastSwingHigh,
      swingLow: Number.isNaN(lastSwingLow) ? bar.low : lastSwingLow,
      triggerLevel: dir === 'long' ? mssHighTgt : mssLowTgt,
    })
    lastEntryBar = i
  }

  return entries
}

// ── Live state: "what are we waiting for" per pair ───────────────────

export interface IctLiveState {
  bias: 'armed_long' | 'armed_short' | 'neutral'
  lastClose: number
  lastTime: number
  atr: number
  htfBias: 'up' | 'down' | 'neutral'
  killZone: 'london' | 'newyork' | 'off'
  inKillZone: boolean
  // Present only when armed:
  sweepLevel: number | null   // the liquidity that was swept (stop reference)
  mssTarget: number | null    // the level a close must break to confirm entry
  mssBroken: boolean          // has price already closed through the MSS level?
  confirmationsReady: string[] // confluences currently satisfied
  confluenceScore: number
  // Projected trade plan (fills on the MSS close; same level math as the scanner)
  entry: number | null
  stopLoss: number | null
  takeProfit: number | null
  riskReward: number | null
}

// Replays the identical sweep→MSS machine and returns the CURRENT state at
// the last closed bar — the live watchlist read. Arms on a sweep, disarms on
// invalidation OR once the MSS level breaks (that window has passed).
export function analyzeIctState(candles: Candle[], opts: Partial<IctBacktestOptions> = {}): IctLiveState {
  const o: IctBacktestOptions = { ...DEFAULT_ICT_OPTIONS, ...opts }
  const n = candles.length
  const closes = candles.map((c) => c.close)
  const atr = atrSeries(candles, o.atrLen)
  const rsi = rsiSeries(closes, 14)
  const htf = htfBiasSeries(candles)

  let lastSwingHigh = NaN, prevSwingHigh = NaN
  let lastSwingLow = NaN, prevSwingLow = NaN
  let armedLong = false, sweepLow = NaN, mssHighTgt = NaN
  let armedShort = false, sweepHigh = NaN, mssLowTgt = NaN
  const p = o.pivotLen

  for (let i = 0; i < n; i++) {
    const c0 = i - p
    if (c0 >= p) {
      let isPh = true, isPl = true
      for (let k = c0 - p; k <= c0 + p; k++) {
        if (k === c0) continue
        if (candles[k].high >= candles[c0].high) isPh = false
        if (candles[k].low <= candles[c0].low) isPl = false
        if (!isPh && !isPl) break
      }
      if (isPh) { prevSwingHigh = lastSwingHigh; lastSwingHigh = candles[c0].high }
      if (isPl) { prevSwingLow = lastSwingLow; lastSwingLow = candles[c0].low }
    }
    const bar = candles[i]
    if (!Number.isNaN(lastSwingLow) && bar.low < lastSwingLow && bar.close > lastSwingLow) {
      armedLong = true; sweepLow = bar.low; mssHighTgt = lastSwingHigh
    }
    if (!Number.isNaN(lastSwingHigh) && bar.high > lastSwingHigh && bar.close < lastSwingHigh) {
      armedShort = true; sweepHigh = bar.high; mssLowTgt = lastSwingLow
    }
    if (armedLong && bar.close < sweepLow) armedLong = false
    if (armedShort && bar.close > sweepHigh) armedShort = false
    // The entry window closes once the MSS level breaks (scanner would have
    // taken it there); after that we wait for the next sweep.
    if (armedLong && !Number.isNaN(mssHighTgt) && bar.close > mssHighTgt) armedLong = false
    if (armedShort && !Number.isNaN(mssLowTgt) && bar.close < mssLowTgt) armedShort = false
  }

  const i = n - 1
  const bar = candles[i]
  const barRange = bar.high - bar.low
  const displacement = barRange >= 1.2 * atr[i] && Math.abs(bar.close - bar.open) >= 0.5 * barRange
  const bullFvg = i >= 2 && bar.low > candles[i - 2].high
  const bearFvg = i >= 2 && bar.high < candles[i - 2].low
  const utcH = new Date(bar.time).getUTCHours()
  const killZone: IctLiveState['killZone'] = utcH >= 7 && utcH < 10 ? 'london' : utcH >= 12 && utcH < 15 ? 'newyork' : 'off'
  const htfBias: IctLiveState['htfBias'] = htf[i] > 0 ? 'up' : htf[i] < 0 ? 'down' : 'neutral'

  const base: IctLiveState = {
    bias: 'neutral',
    lastClose: bar.close,
    lastTime: bar.time,
    atr: atr[i],
    htfBias,
    killZone,
    inKillZone: killZone !== 'off',
    sweepLevel: null,
    mssTarget: null,
    mssBroken: false,
    confirmationsReady: [],
    confluenceScore: 0,
    entry: null,
    stopLoss: null,
    takeProfit: null,
    riskReward: null,
  }

  const round6 = (x: number) => Math.round(x * 1e6) / 1e6

  if (armedLong) {
    const eq = (mssHighTgt + sweepLow) / 2
    const ready = [
      ['fvg', bullFvg], ['htf', htf[i] > 0], ['displacement', displacement],
      ['rsi', !Number.isNaN(rsi[i]) && rsi[i] > 50], ['discount', bar.close <= eq],
    ].filter(([, ok]) => ok).map(([name]) => name as string)
    // Projected plan (same math as the scanner): enter on the MSS break,
    // stop below the swept low, target opposing liquidity or minRR.
    const entry = mssHighTgt
    const stop = sweepLow - 0.1 * atr[i]
    const risk = entry - stop
    const target = !Number.isNaN(prevSwingHigh) && prevSwingHigh > entry + o.minRr * risk ? prevSwingHigh : entry + o.minRr * risk
    return {
      ...base, bias: 'armed_long', sweepLevel: sweepLow, mssTarget: mssHighTgt,
      mssBroken: bar.close > mssHighTgt, confirmationsReady: ready, confluenceScore: ready.length,
      entry: round6(entry), stopLoss: round6(stop), takeProfit: round6(target),
      riskReward: risk > 0 ? Math.round(((target - entry) / risk) * 100) / 100 : null,
    }
  }
  if (armedShort) {
    const eq = (sweepHigh + mssLowTgt) / 2
    const ready = [
      ['fvg', bearFvg], ['htf', htf[i] < 0], ['displacement', displacement],
      ['rsi', !Number.isNaN(rsi[i]) && rsi[i] < 50], ['premium', bar.close >= eq],
    ].filter(([, ok]) => ok).map(([name]) => name as string)
    const entry = mssLowTgt
    const stop = sweepHigh + 0.1 * atr[i]
    const risk = stop - entry
    const target = !Number.isNaN(prevSwingLow) && prevSwingLow < entry - o.minRr * risk ? prevSwingLow : entry - o.minRr * risk
    return {
      ...base, bias: 'armed_short', sweepLevel: sweepHigh, mssTarget: mssLowTgt,
      mssBroken: bar.close < mssLowTgt, confirmationsReady: ready, confluenceScore: ready.length,
      entry: round6(entry), stopLoss: round6(stop), takeProfit: round6(target),
      riskReward: risk > 0 ? Math.round(((entry - target) / risk) * 100) / 100 : null,
    }
  }
  return base
}

// ── The replay: entries + conservative forward simulation ────────────

export function runIctBacktest(candles: Candle[], opts: Partial<IctBacktestOptions> = {}): IctBacktestResult {
  const o: IctBacktestOptions = { ...DEFAULT_ICT_OPTIONS, ...opts }
  const n = candles.length
  const entries = generateIctEntries(candles, o)

  const trades: BacktestTrade[] = entries.map((e) => {
    const { barIndex: i, direction: dir, entry, stop, target } = e
    const sign = dir === 'long' ? 1 : -1
    const risk = Math.abs(entry - stop)
    const targetR = (sign * (target - entry)) / risk
    const tp1 = entry + sign * risk // 1R
    let outcome: BacktestTrade['outcome'] = 'timeout'
    let rMultiple = 0
    let exitTime = e.time
    let holdBars = 0
    let tp1Banked = false // partial mode: booked half at 1R, stop now at breakeven
    // maxHoldBars <= 0 → no timeout: run to the end of data (resolves on stop/target).
    const holdCap = o.maxHoldBars > 0 ? o.maxHoldBars : n
    const lastJ = Math.min(n, i + 1 + holdCap) - 1
    for (let j = i + 1; j < Math.min(n, i + 1 + holdCap); j++) {
      const b = candles[j]
      holdBars = j - i
      exitTime = b.time
      const stopHit = dir === 'long' ? b.low <= stop : b.high >= stop
      const tgtHit = dir === 'long' ? b.high >= target : b.low <= target
      const tp1Hit = dir === 'long' ? b.high >= tp1 : b.low <= tp1
      const beHit = dir === 'long' ? b.low <= entry : b.high >= entry // breakeven after TP1

      if (!o.partialTp) {
        // Full position: stop wins ambiguous bars (conservative)
        if (stopHit) { outcome = 'loss'; rMultiple = -1; break }
        if (tgtHit) { outcome = 'win'; rMultiple = targetR; break }
      } else if (!tp1Banked) {
        // Before TP1: original stop is live; conservative stop-first
        if (stopHit) { outcome = 'loss'; rMultiple = -1; break }
        if (tp1Hit) { tp1Banked = true } // bank +0.5R, move stop to breakeven
      } else {
        // After TP1: half booked (+0.5R), remainder rides to target or breakeven
        if (beHit) { outcome = 'partial'; rMultiple = 0.5; break } // 0.5R + 0 on runner
        if (tgtHit) { outcome = 'win'; rMultiple = 0.5 + 0.5 * targetR; break }
      }

      if (j === lastJ) {
        outcome = 'timeout'
        const runnerR = (sign * (b.close - entry)) / risk
        rMultiple = o.partialTp && tp1Banked ? 0.5 + 0.5 * runnerR : runnerR
      }
    }
    // Transaction cost: the spread is paid once per round trip regardless of
    // outcome, so express it in R (cost / risk) and deduct from the result.
    // For tight FX pairs this is ~0.02R; for gold it can be a meaningful
    // fraction of R, which is exactly why gross backtests flatter metals.
    const costR = o.spreadPrice > 0 && risk > 0 ? o.spreadPrice / risk : 0
    rMultiple -= costR
    return {
      entryTime: e.time, exitTime, direction: dir, entry, stop, target,
      confluenceScore: e.confluenceScore, confirmations: e.confirmations, session: e.session,
      outcome, rMultiple: Math.round(rMultiple * 100) / 100, holdBars,
    }
  })

  // Max drawdown on the cumulative R curve
  let peak = 0, dd = 0, cum = 0
  for (const t of trades) {
    cum += t.rMultiple
    peak = Math.max(peak, cum)
    dd = Math.max(dd, peak - cum)
  }

  const byConfluence: Record<string, BacktestBucket> = {}
  for (const level of [1, 2, 3, 4, 5]) {
    const subset = trades.filter((t) => t.confluenceScore === level)
    if (subset.length) byConfluence[String(level)] = bucketStats(subset)
  }
  const bySession: Record<string, BacktestBucket> = {}
  for (const s of ['london', 'newyork', 'other'] as const) {
    const subset = trades.filter((t) => t.session === s)
    if (subset.length) bySession[s] = bucketStats(subset)
  }
  // Per-confirmation attribution: the win rate/expectancy of trades that
  // INCLUDED each individual confluence — reveals which factors carry edge
  // (require those) and which are noise (drop them). This is how you improve
  // the bad performers instead of just cutting subsets blindly.
  const byConfirmation: Record<string, BacktestBucket> = {}
  for (const conf of ['fvg', 'htf', 'displacement', 'rsi', 'discount', 'premium']) {
    const withIt = trades.filter((t) => t.confirmations.includes(conf))
    if (withIt.length) byConfirmation[conf] = bucketStats(withIt)
  }
  const byDirection: Record<string, BacktestBucket> = {}
  for (const d of ['long', 'short'] as const) {
    const subset = trades.filter((t) => t.direction === d)
    if (subset.length) byDirection[d] = bucketStats(subset)
  }

  return {
    bars: n,
    firstBarTime: n ? candles[0].time : 0,
    lastBarTime: n ? candles[n - 1].time : 0,
    options: o,
    overall: bucketStats(trades),
    byConfluence,
    bySession,
    byConfirmation,
    byDirection,
    maxDrawdownR: Math.round(dd * 100) / 100,
    trades,
  }
}
