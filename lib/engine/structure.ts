import type { Candle, CurrencyPair } from '@/types/forex'
import { detectSwingPoints, detectStructureBreaks, getMarketStructure } from '@/lib/smc/structure'
import { detectOrderBlocks, findNearestOrderBlock } from '@/lib/smc/orderblocks'
import { detectLiquidityLevels, detectLiquiditySweeps, getTargetLiquidity } from '@/lib/smc/liquidity'
import { ema } from '@/lib/forex/indicators'
import type { DetectedSetup, Direction, HtfBias, RegimeState, StructureView } from './types'

// ─── Higher-timeframe bias ───────────────────────────────────────────

export function computeHtfBias(htfCandles: Candle[]): { bias: HtfBias; score: number; notes: string[] } {
  const swings = detectSwingPoints(htfCandles)
  const breaks = detectStructureBreaks(htfCandles, swings)
  const structure = getMarketStructure(htfCandles, swings, breaks)

  const e50 = ema(htfCandles, 50)
  const lastEma = lastValid(e50)
  const price = htfCandles[htfCandles.length - 1]?.close ?? 0
  const emaBias: HtfBias = lastEma === undefined ? 'neutral' : price > lastEma ? 'bullish' : 'bearish'

  const structBias: HtfBias = structure.bias === 'ranging' ? 'neutral' : structure.bias

  const notes: string[] = []
  let bias: HtfBias
  let score: number

  if (structBias !== 'neutral' && structBias === emaBias) {
    bias = structBias
    score = 88
    notes.push(`4H structure ${structBias} (${structBias === 'bullish' ? 'HH/HL' : 'LH/LL'}) and price ${structBias === 'bullish' ? 'above' : 'below'} 4H EMA50 — aligned`)
  } else if (structBias !== 'neutral') {
    bias = structBias
    score = 62
    notes.push(`4H structure ${structBias} but EMA50 position disagrees — bias with reduced conviction`)
  } else if (emaBias !== 'neutral') {
    bias = 'neutral'
    score = 45
    notes.push(`4H structure ranging; only EMA50 leans ${emaBias} — treated as neutral`)
  } else {
    bias = 'neutral'
    score = 40
    notes.push('4H timeframe has no directional structure')
  }

  const lastBreak = structure.lastCHOCH ?? structure.lastBOS
  if (lastBreak) {
    notes.push(`Last 4H ${lastBreak.type} was ${lastBreak.direction} at ${lastBreak.brokenLevel.toFixed(5)}`)
  }

  return { bias, score, notes }
}

// ─── Full structure view for a pair ──────────────────────────────────

export function buildStructureView(
  signalCandles: Candle[],
  htfCandles: Candle[],
  symbol: string
): StructureView {
  const swings = detectSwingPoints(signalCandles)
  const breaks = detectStructureBreaks(signalCandles, swings)
  const structure = getMarketStructure(signalCandles, swings, breaks)
  const orderBlocks = detectOrderBlocks(signalCandles, symbol)
  const levels = detectLiquidityLevels(signalCandles, swings, symbol)
  const sweeps = detectLiquiditySweeps(signalCandles, levels, symbol)
  const htf = computeHtfBias(htfCandles)

  return {
    htfBias: htf.bias,
    htfBiasScore: htf.score,
    htfNotes: htf.notes,
    signalTf: structure,
    swings,
    keyLevels: levels,
    orderBlocks,
    recentBreaks: breaks.slice(-5),
    recentSweeps: sweeps,
  }
}

// ─── Setup detection ─────────────────────────────────────────────────

interface SetupContext {
  pair: CurrencyPair
  candles: Candle[]
  view: StructureView
  regime: RegimeState
  atr: number // price units
}

export function detectSetups(ctx: SetupContext): DetectedSetup[] {
  const setups: DetectedSetup[] = [
    ...detectPullbackContinuation(ctx),
    ...detectOrderblockMitigation(ctx),
    ...detectBreakoutRetest(ctx),
    ...detectSweepReversal(ctx),
    ...detectRangeFade(ctx),
  ]
  // Highest technical quality first; at most 2 candidates per pair to keep
  // the product philosophy: fewer signals, higher quality.
  return setups.sort((a, b) => b.quality - a.quality).slice(0, 2)
}

function detectPullbackContinuation(ctx: SetupContext): DetectedSetup[] {
  const { view, candles, atr, pair } = ctx
  if (view.htfBias === 'neutral') return []
  const dir: Direction = view.htfBias === 'bullish' ? 'long' : 'short'
  const s = view.signalTf
  if (s.currentLeg !== 'retracement' || s.fibLevel < 30 || s.fibLevel > 78) return []
  if ((dir === 'long' && s.bias === 'bearish') || (dir === 'short' && s.bias === 'bullish')) return []

  const highs = view.swings.filter((x) => x.type === 'high')
  const lows = view.swings.filter((x) => x.type === 'low')
  if (highs.length === 0 || lows.length === 0) return []
  const lastHigh = highs[highs.length - 1]
  const lastLow = lows[lows.length - 1]
  const range = lastHigh.price - lastLow.price
  if (range <= 0) return []

  const d = pair.digits
  let entry: number, stopLoss: number, tp1: number, tp2: number, tp3: number
  if (dir === 'long') {
    entry = round(lastHigh.price - range * 0.5, d) // 50% retracement of the impulse
    stopLoss = round(lastLow.price - atr * 0.5, d)
    tp1 = round(lastHigh.price, d)
    tp2 = round(lastHigh.price + range * 0.618, d)
    tp3 = round(lastHigh.price + range, d)
  } else {
    entry = round(lastLow.price + range * 0.5, d)
    stopLoss = round(lastHigh.price + atr * 0.5, d)
    tp1 = round(lastLow.price, d)
    tp2 = round(lastLow.price - range * 0.618, d)
    tp3 = round(lastLow.price - range, d)
  }

  // entry must be on the correct side of current price and within reach
  const price = candles[candles.length - 1].close
  const reach = Math.abs(price - entry)
  if (reach > atr * 1.6) return []

  // OB confluence bumps quality
  const obConfluence = view.orderBlocks.some(
    (ob) =>
      !ob.mitigated &&
      ob.type === (dir === 'long' ? 'bullish' : 'bearish') &&
      entry >= ob.low - atr * 0.2 &&
      entry <= ob.high + atr * 0.2
  )

  const rationale = [
    `Higher-timeframe bias is ${view.htfBias}; 15m is retracing (${Math.round(s.fibLevel)}% of the last impulse)`,
    `Limit entry at the 50% retracement of the ${dir === 'long' ? `${fmt(lastLow.price, d)} → ${fmt(lastHigh.price, d)}` : `${fmt(lastHigh.price, d)} → ${fmt(lastLow.price, d)}`} leg`,
  ]
  if (obConfluence) rationale.push('Entry zone overlaps an unmitigated order block — added confluence')

  return [
    {
      type: 'pullback_continuation',
      direction: dir,
      entryType: 'limit',
      entry,
      stopLoss,
      takeProfit1: tp1,
      takeProfit2: tp2,
      takeProfit3: tp3,
      quality: obConfluence ? 82 : 70,
      rationale,
      invalidation:
        dir === 'long'
          ? `A 15m close below ${fmt(lastLow.price, d)} (the swing low that anchors this leg) invalidates the idea before entry.`
          : `A 15m close above ${fmt(lastHigh.price, d)} (the swing high that anchors this leg) invalidates the idea before entry.`,
    },
  ]
}

function detectOrderblockMitigation(ctx: SetupContext): DetectedSetup[] {
  const { view, candles, atr, pair } = ctx
  if (view.htfBias === 'neutral') return []
  const dir: Direction = view.htfBias === 'bullish' ? 'long' : 'short'
  const obDir = dir === 'long' ? 'bullish' : 'bearish'
  const price = candles[candles.length - 1].close
  const ob = findNearestOrderBlock(price, view.orderBlocks, obDir, pair.pipSize)
  if (!ob) return []

  const d = pair.digits
  const proximal = dir === 'long' ? ob.high : ob.low
  const distal = dir === 'long' ? ob.low : ob.high
  const distance = Math.abs(price - proximal)
  if (distance > atr * 2.2) return [] // too far to be actionable this session

  const entry = round(proximal, d)
  const stopLoss = round(dir === 'long' ? distal - atr * 0.35 : distal + atr * 0.35, d)
  const risk = Math.abs(entry - stopLoss)
  if (risk <= 0) return []

  const targets = getTargetLiquidity(price, view.keyLevels, obDir)
  const tp1 = round(dir === 'long' ? entry + risk * 1.5 : entry - risk * 1.5, d)
  const tp2Liquidity = targets[0]?.price
  const tp2 = round(
    tp2Liquidity && Math.abs(tp2Liquidity - entry) > risk * 1.8
      ? tp2Liquidity
      : dir === 'long'
        ? entry + risk * 2.5
        : entry - risk * 2.5,
    d
  )
  const tp3 = targets[1] ? round(targets[1].price, d) : undefined

  const quality = ob.strength === 'strong' ? 80 : ob.strength === 'medium' ? 68 : 55

  return [
    {
      type: 'orderblock_mitigation',
      direction: dir,
      entryType: 'limit',
      entry,
      stopLoss,
      takeProfit1: tp1,
      takeProfit2: tp2,
      takeProfit3: tp3,
      quality,
      rationale: [
        `Unmitigated ${ob.strength} ${obDir} order block at ${fmt(ob.low, d)}–${fmt(ob.high, d)} in line with the ${view.htfBias} higher-timeframe bias`,
        `Limit order at the ${dir === 'long' ? 'top' : 'bottom'} of the block; stop beyond the ${dir === 'long' ? 'low' : 'high'} plus an ATR buffer`,
        tp2Liquidity
          ? `TP2 targets resting liquidity at ${fmt(tp2, d)}`
          : 'TP2 set at 2.5R (no clean liquidity target in range)',
      ],
      invalidation: `If price trades through the block and closes beyond ${fmt(stopLoss, d)} on the 15m before filling the entry, the block has failed — cancel the order.`,
    },
  ]
}

function detectBreakoutRetest(ctx: SetupContext): DetectedSetup[] {
  const { view, candles, atr, pair } = ctx
  const breaks = view.recentBreaks
  if (breaks.length === 0) return []
  const last = breaks[breaks.length - 1]
  const barsAgo = candles.length - 1 - candles.findIndex((c) => c.time === last.time)
  if (barsAgo < 0 || barsAgo > 12) return []

  const dir: Direction = last.direction === 'bullish' ? 'long' : 'short'
  // Only trade breaks in the direction of (or resetting) the HTF bias.
  if (view.htfBias !== 'neutral') {
    const aligned = (dir === 'long') === (view.htfBias === 'bullish')
    if (!aligned && last.type !== 'CHOCH') return []
  }

  const price = candles[candles.length - 1].close
  const level = last.brokenLevel
  if (Math.abs(price - level) > atr * 0.6) return [] // not retesting yet

  const d = pair.digits
  const entry = round(level, d)
  const stopLoss = round(dir === 'long' ? level - atr * 1.0 : level + atr * 1.0, d)
  const risk = Math.abs(entry - stopLoss)
  const targets = getTargetLiquidity(price, view.keyLevels, dir === 'long' ? 'bullish' : 'bearish')
  const tp1 = round(dir === 'long' ? entry + risk * 1.5 : entry - risk * 1.5, d)
  const tp2 = round(
    targets[0] && Math.abs(targets[0].price - entry) > risk * 1.6
      ? targets[0].price
      : dir === 'long'
        ? entry + risk * 2.4
        : entry - risk * 2.4,
    d
  )

  return [
    {
      type: 'breakout_retest',
      direction: dir,
      entryType: 'limit',
      entry,
      stopLoss,
      takeProfit1: tp1,
      takeProfit2: tp2,
      quality: last.type === 'CHOCH' ? 74 : 66,
      rationale: [
        `15m ${last.type} ${last.direction} through ${fmt(level, d)} ${barsAgo} bars ago; price is now retesting the broken level`,
        `Entry at the retest of ${fmt(level, d)} with the stop one full ATR beyond the level`,
      ],
      invalidation: `A 15m close back ${dir === 'long' ? 'below' : 'above'} ${fmt(level, d)} negates the break — stand down.`,
    },
  ]
}

function detectSweepReversal(ctx: SetupContext): DetectedSetup[] {
  const { view, candles, atr, pair } = ctx
  const sweep = view.recentSweeps.find((s) => s.reversed)
  if (!sweep) return []
  const barsAgo = candles.length - 1 - candles.findIndex((c) => c.time === sweep.time)
  if (barsAgo < 0 || barsAgo > 6) return []

  const dir: Direction = sweep.type === 'low_sweep' ? 'long' : 'short'
  const d = pair.digits
  const price = candles[candles.length - 1].close
  const entry = round(price, d) // reversal confirmed — execute at market/near-touch
  const stopLoss = round(dir === 'long' ? sweep.price - atr * 0.25 : sweep.price + atr * 0.25, d)
  const risk = Math.abs(entry - stopLoss)
  if (risk <= 0 || risk > atr * 2) return []

  const targets = getTargetLiquidity(price, view.keyLevels, dir === 'long' ? 'bullish' : 'bearish')
  const tp1 = round(dir === 'long' ? entry + risk * 1.5 : entry - risk * 1.5, d)
  const tp2 = round(
    targets[0] && Math.abs(targets[0].price - entry) > risk * 1.6
      ? targets[0].price
      : dir === 'long'
        ? entry + risk * 2.5
        : entry - risk * 2.5,
    d
  )

  const counterTrend =
    view.htfBias !== 'neutral' && (dir === 'long') !== (view.htfBias === 'bullish')

  return [
    {
      type: 'liquidity_sweep_reversal',
      direction: dir,
      entryType: 'market',
      entry,
      stopLoss,
      takeProfit1: tp1,
      takeProfit2: tp2,
      quality: counterTrend ? 58 : 76,
      rationale: [
        `${sweep.type === 'low_sweep' ? 'Sell-side' : 'Buy-side'} liquidity swept at ${fmt(sweep.level.price, d)} (${sweep.pipsSwept.toFixed(1)} pips through the level) with confirmed rejection`,
        `Stop tucked ${dir === 'long' ? 'below' : 'above'} the sweep extreme at ${fmt(sweep.price, d)}`,
        counterTrend ? 'Counter to higher-timeframe bias — reduced quality, tighter management' : 'Sweep occurred in the direction of the higher-timeframe bias',
      ],
      invalidation: `A second sweep of ${fmt(sweep.price, d)} without reclaim means the level is being run — the reversal premise is dead.`,
    },
  ]
}

function detectRangeFade(ctx: SetupContext): DetectedSetup[] {
  const { view, candles, atr, pair, regime } = ctx
  if (regime.tag !== 'ranging' && regime.tag !== 'quiet') return []
  if (view.htfBias !== 'neutral') return [] // fade only structureless markets

  const window = candles.slice(-48)
  const hi = Math.max(...window.map((c) => c.high))
  const lo = Math.min(...window.map((c) => c.low))
  const range = hi - lo
  if (range < atr * 2.5) return [] // range too small to fade after costs

  const price = candles[candles.length - 1].close
  const pos = (price - lo) / range // 0 bottom … 1 top
  const d = pair.digits

  if (pos >= 0.88) {
    const entry = round(price, d)
    const stopLoss = round(hi + atr * 0.5, d)
    const tp1 = round(lo + range * 0.5, d)
    const tp2 = round(lo + range * 0.15, d)
    return [
      {
        type: 'range_fade',
        direction: 'short',
        entryType: 'market',
        entry,
        stopLoss,
        takeProfit1: tp1,
        takeProfit2: tp2,
        quality: 60,
        rationale: [
          `No higher-timeframe bias; 48-bar range ${fmt(lo, d)}–${fmt(hi, d)} with price in the top ${Math.round((1 - pos) * 100)}%`,
          'Fading the range extreme back toward the mid',
        ],
        invalidation: `Two consecutive 15m closes above ${fmt(hi, d)} converts the range to a breakout — do not fade.`,
      },
    ]
  }
  if (pos <= 0.12) {
    const entry = round(price, d)
    const stopLoss = round(lo - atr * 0.5, d)
    const tp1 = round(lo + range * 0.5, d)
    const tp2 = round(lo + range * 0.85, d)
    return [
      {
        type: 'range_fade',
        direction: 'long',
        entryType: 'market',
        entry,
        stopLoss,
        takeProfit1: tp1,
        takeProfit2: tp2,
        quality: 60,
        rationale: [
          `No higher-timeframe bias; 48-bar range ${fmt(lo, d)}–${fmt(hi, d)} with price in the bottom ${Math.round(pos * 100)}%`,
          'Fading the range extreme back toward the mid',
        ],
        invalidation: `Two consecutive 15m closes below ${fmt(lo, d)} converts the range to a breakdown — do not fade.`,
      },
    ]
  }
  return []
}

// ─── helpers ─────────────────────────────────────────────────────────

function round(n: number, digits: number): number {
  return parseFloat(n.toFixed(digits))
}

function fmt(n: number, digits: number): string {
  return n.toFixed(digits)
}

function lastValid(series: number[]): number | undefined {
  for (let i = series.length - 1; i >= 0; i--) {
    if (!isNaN(series[i])) return series[i]
  }
  return undefined
}
