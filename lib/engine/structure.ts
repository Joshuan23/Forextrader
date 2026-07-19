import type { Candle, CurrencyPair } from '@/types/forex'
import { detectSwingPoints, detectStructureBreaks, getMarketStructure } from '@/lib/smc/structure'
import { detectOrderBlocks, findNearestOrderBlock } from '@/lib/smc/orderblocks'
import { detectLiquidityLevels, detectLiquiditySweeps, getTargetLiquidity } from '@/lib/smc/liquidity'
import { ema } from '@/lib/forex/indicators'
import type {
  DetectedSetup,
  Direction,
  HtfBias,
  LevelDerivation,
  RegimeState,
  StructureView,
} from './types'

// ─── Higher-timeframe bias ───────────────────────────────────────────
// bias(4H) = agree(structureBias, emaBias):
//   structureBias: HH+HL → bullish; LH+LL → bearish; else neutral
//     (compares the last two 4H swing highs and last two 4H swing lows,
//      swings = local extreme over ±3 bars)
//   emaBias: close > EMA50(4H) → bullish; close < EMA50 → bearish
// score: both agree → 88 · structure only → 62 · EMA only → 45 (bias
// stays neutral) · neither → 40 (neutral)

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
    notes.push(
      `4H structure ${structBias} (${structBias === 'bullish' ? 'HH/HL' : 'LH/LL'}) AND close ${structBias === 'bullish' ? '>' : '<'} 4H EMA50 (${lastEma?.toFixed(5)}) → bias ${structBias}, conviction 88`
    )
  } else if (structBias !== 'neutral') {
    bias = structBias
    score = 62
    notes.push(
      `4H structure ${structBias} but close ${emaBias === 'bullish' ? '>' : '<'} EMA50 (${lastEma?.toFixed(5)}) disagrees → bias ${structBias}, conviction 62`
    )
  } else if (emaBias !== 'neutral') {
    bias = 'neutral'
    score = 45
    notes.push(`4H structure ranging; only EMA50 leans ${emaBias} → neutral, conviction 45`)
  } else {
    bias = 'neutral'
    score = 40
    notes.push('4H structure ranging and no EMA lean → neutral, conviction 40')
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

// Derivation-row helper.
function d(
  key: LevelDerivation['key'],
  label: string,
  value: number,
  formula: string,
  computation: string,
  reason: string
): LevelDerivation {
  return { key, label, value, formula, computation, reason }
}

// ── Pullback continuation ──
// entry = 50% retracement of the last impulse leg (limit)
// stop  = anchor swing ∓ 0.5×ATR
// TP1   = impulse extreme · TP2 = extreme ± 0.618×leg · TP3 = extreme ± 1.0×leg
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

  const dg = pair.digits
  const f = (n: number) => n.toFixed(dg)
  let entry: number, stopLoss: number, tp1: number, tp2: number, tp3: number
  let derivations: LevelDerivation[]

  if (dir === 'long') {
    entry = round(lastHigh.price - range * 0.5, dg)
    stopLoss = round(lastLow.price - atr * 0.5, dg)
    tp1 = round(lastHigh.price, dg)
    tp2 = round(lastHigh.price + range * 0.618, dg)
    tp3 = round(lastHigh.price + range, dg)
    derivations = [
      d('entry', 'Entry', entry, 'swingHigh − 0.50 × leg', `${f(lastHigh.price)} − 0.50 × ${f(range)} = ${f(entry)}`,
        `Limit at the 50% retracement of the ${f(lastLow.price)}→${f(lastHigh.price)} impulse — the deepest pullback that keeps the leg's HL structure intact`),
      d('stopLoss', 'Stop', stopLoss, 'swingLow − 0.50 × ATR', `${f(lastLow.price)} − 0.50 × ${f(atr)} = ${f(stopLoss)}`,
        `Beyond the swing low that anchors the leg (structure invalidation), plus a half-ATR buffer against stop-hunt wicks`),
      d('takeProfit1', 'TP1', tp1, 'swingHigh', `= ${f(tp1)}`,
        'The impulse extreme — first liquidity objective where partial profit is banked'),
      d('takeProfit2', 'TP2', tp2, 'swingHigh + 0.618 × leg', `${f(lastHigh.price)} + 0.618 × ${f(range)} = ${f(tp2)}`,
        'Standard 61.8% fib extension of the impulse — the measured continuation target'),
      d('takeProfit3', 'TP3', tp3, 'swingHigh + 1.00 × leg', `${f(lastHigh.price)} + 1.00 × ${f(range)} = ${f(tp3)}`,
        'Full 100% leg extension — runner target if the trend stays one-sided'),
    ]
  } else {
    entry = round(lastLow.price + range * 0.5, dg)
    stopLoss = round(lastHigh.price + atr * 0.5, dg)
    tp1 = round(lastLow.price, dg)
    tp2 = round(lastLow.price - range * 0.618, dg)
    tp3 = round(lastLow.price - range, dg)
    derivations = [
      d('entry', 'Entry', entry, 'swingLow + 0.50 × leg', `${f(lastLow.price)} + 0.50 × ${f(range)} = ${f(entry)}`,
        `Limit at the 50% retracement of the ${f(lastHigh.price)}→${f(lastLow.price)} impulse — the deepest pullback that keeps the leg's LH structure intact`),
      d('stopLoss', 'Stop', stopLoss, 'swingHigh + 0.50 × ATR', `${f(lastHigh.price)} + 0.50 × ${f(atr)} = ${f(stopLoss)}`,
        `Beyond the swing high that anchors the leg (structure invalidation), plus a half-ATR buffer against stop-hunt wicks`),
      d('takeProfit1', 'TP1', tp1, 'swingLow', `= ${f(tp1)}`,
        'The impulse extreme — first liquidity objective where partial profit is banked'),
      d('takeProfit2', 'TP2', tp2, 'swingLow − 0.618 × leg', `${f(lastLow.price)} − 0.618 × ${f(range)} = ${f(tp2)}`,
        'Standard 61.8% fib extension of the impulse — the measured continuation target'),
      d('takeProfit3', 'TP3', tp3, 'swingLow − 1.00 × leg', `${f(lastLow.price)} − 1.00 × ${f(range)} = ${f(tp3)}`,
        'Full 100% leg extension — runner target if the trend stays one-sided'),
    ]
  }

  // entry must be within actionable reach of current price
  const price = candles[candles.length - 1].close
  if (Math.abs(price - entry) > atr * 1.6) return []

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
    `Limit entry at the 50% retracement of the ${dir === 'long' ? `${f(lastLow.price)} → ${f(lastHigh.price)}` : `${f(lastHigh.price)} → ${f(lastLow.price)}`} leg`,
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
      qualityRule: obConfluence
        ? 'base 70 (valid pullback, fib 30–78%) + 12 (entry inside unmitigated order block) = 82'
        : 'base 70 (valid pullback, fib 30–78%), no order-block confluence',
      derivations,
      rationale,
      invalidation:
        dir === 'long'
          ? `A 15m close below ${f(lastLow.price)} (the swing low that anchors this leg) invalidates the idea before entry.`
          : `A 15m close above ${f(lastHigh.price)} (the swing high that anchors this leg) invalidates the idea before entry.`,
    },
  ]
}

// ── Order-block mitigation ──
// entry = proximal edge of nearest unmitigated OB in bias direction (limit)
// stop  = distal edge ∓ 0.35×ATR
// TP1 = entry ± 1.5×risk · TP2 = nearest unswept liquidity ≥1.8R else 2.5R
function detectOrderblockMitigation(ctx: SetupContext): DetectedSetup[] {
  const { view, candles, atr, pair } = ctx
  if (view.htfBias === 'neutral') return []
  const dir: Direction = view.htfBias === 'bullish' ? 'long' : 'short'
  const obDir = dir === 'long' ? 'bullish' : 'bearish'
  const price = candles[candles.length - 1].close
  const ob = findNearestOrderBlock(price, view.orderBlocks, obDir, pair.pipSize)
  if (!ob) return []

  const dg = pair.digits
  const f = (n: number) => n.toFixed(dg)
  const proximal = dir === 'long' ? ob.high : ob.low
  const distal = dir === 'long' ? ob.low : ob.high
  if (Math.abs(price - proximal) > atr * 2.2) return []

  const entry = round(proximal, dg)
  const stopLoss = round(dir === 'long' ? distal - atr * 0.35 : distal + atr * 0.35, dg)
  const risk = Math.abs(entry - stopLoss)
  if (risk <= 0) return []

  const targets = getTargetLiquidity(price, view.keyLevels, obDir)
  const tp1 = round(dir === 'long' ? entry + risk * 1.5 : entry - risk * 1.5, dg)
  const tp2Liquidity = targets[0]?.price
  const useLiquidityTp2 = Boolean(tp2Liquidity && Math.abs(tp2Liquidity - entry) > risk * 1.8)
  const tp2 = round(
    useLiquidityTp2 ? (tp2Liquidity as number) : dir === 'long' ? entry + risk * 2.5 : entry - risk * 2.5,
    dg
  )
  const tp3 = targets[1] ? round(targets[1].price, dg) : undefined

  const sign = dir === 'long' ? '+' : '−'
  const derivations: LevelDerivation[] = [
    d('entry', 'Entry', entry, dir === 'long' ? 'orderBlock.high (proximal edge)' : 'orderBlock.low (proximal edge)', `= ${f(entry)}`,
      `First touch of the ${ob.strength} ${obDir} order block ${f(ob.low)}–${f(ob.high)} — where the originating imbalance should defend`),
    d('stopLoss', 'Stop', stopLoss, `orderBlock.${dir === 'long' ? 'low' : 'high'} ${dir === 'long' ? '−' : '+'} 0.35 × ATR`, `${f(distal)} ${dir === 'long' ? '−' : '+'} 0.35 × ${f(atr)} = ${f(stopLoss)}`,
      'Through the distal edge the block has failed; 0.35×ATR buffer absorbs the spike that often pierces it first'),
    d('takeProfit1', 'TP1', tp1, `entry ${sign} 1.5 × risk`, `${f(entry)} ${sign} 1.5 × ${f(risk)} = ${f(tp1)}`,
      'Fixed 1.5R first objective — pays for the trade before the structural target'),
    d('takeProfit2', 'TP2', tp2, useLiquidityTp2 ? 'nearest unswept liquidity level' : `entry ${sign} 2.5 × risk`,
      useLiquidityTp2 ? `= ${f(tp2)} (${targets[0].type.replace(/_/g, ' ')})` : `${f(entry)} ${sign} 2.5 × ${f(risk)} = ${f(tp2)}`,
      useLiquidityTp2
        ? `Resting ${targets[0].type.replace(/_/g, ' ')} at ${f(tp2)} is ≥1.8R away — price is drawn to unswept liquidity`
        : 'No clean liquidity pool ≥1.8R away in range, so a fixed 2.5R measured target is used'),
    ...(tp3 !== undefined
      ? [d('takeProfit3', 'TP3', tp3, 'next unswept liquidity level', `= ${f(tp3)} (${targets[1].type.replace(/_/g, ' ')})`,
          'Second liquidity pool — runner objective')]
      : []),
  ]

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
      qualityRule: `order-block strength table: strong→80 · medium→68 · weak→55; this block is ${ob.strength} → ${quality}`,
      derivations,
      rationale: [
        `Unmitigated ${ob.strength} ${obDir} order block at ${f(ob.low)}–${f(ob.high)} in line with the ${view.htfBias} higher-timeframe bias`,
        `Limit order at the ${dir === 'long' ? 'top' : 'bottom'} of the block; stop beyond the ${dir === 'long' ? 'low' : 'high'} plus an ATR buffer`,
        useLiquidityTp2 ? `TP2 targets resting liquidity at ${f(tp2)}` : 'TP2 set at 2.5R (no clean liquidity target in range)',
      ],
      invalidation: `If price trades through the block and closes beyond ${f(stopLoss)} on the 15m before filling the entry, the block has failed — cancel the order.`,
    },
  ]
}

// ── Breakout & retest ──
// entry = the broken structure level (limit at retest)
// stop  = level ∓ 1.0×ATR · TP1 = 1.5R · TP2 = liquidity ≥1.6R else 2.4R
function detectBreakoutRetest(ctx: SetupContext): DetectedSetup[] {
  const { view, candles, atr, pair } = ctx
  const breaks = view.recentBreaks
  if (breaks.length === 0) return []
  const last = breaks[breaks.length - 1]
  const barsAgo = candles.length - 1 - candles.findIndex((c) => c.time === last.time)
  if (barsAgo < 0 || barsAgo > 12) return []

  const dir: Direction = last.direction === 'bullish' ? 'long' : 'short'
  if (view.htfBias !== 'neutral') {
    const aligned = (dir === 'long') === (view.htfBias === 'bullish')
    if (!aligned && last.type !== 'CHOCH') return []
  }

  const price = candles[candles.length - 1].close
  const level = last.brokenLevel
  if (Math.abs(price - level) > atr * 0.6) return []

  const dg = pair.digits
  const f = (n: number) => n.toFixed(dg)
  const entry = round(level, dg)
  const stopLoss = round(dir === 'long' ? level - atr * 1.0 : level + atr * 1.0, dg)
  const risk = Math.abs(entry - stopLoss)
  const targets = getTargetLiquidity(price, view.keyLevels, dir === 'long' ? 'bullish' : 'bearish')
  const tp1 = round(dir === 'long' ? entry + risk * 1.5 : entry - risk * 1.5, dg)
  const useLiq = Boolean(targets[0] && Math.abs(targets[0].price - entry) > risk * 1.6)
  const tp2 = round(useLiq ? targets[0].price : dir === 'long' ? entry + risk * 2.4 : entry - risk * 2.4, dg)

  const sign = dir === 'long' ? '+' : '−'
  const derivations: LevelDerivation[] = [
    d('entry', 'Entry', entry, 'brokenLevel', `= ${f(entry)}`,
      `The ${last.type} broke this swing level ${barsAgo} bars ago; former ${dir === 'long' ? 'resistance' : 'support'} should now act as ${dir === 'long' ? 'support' : 'resistance'} on the retest`),
    d('stopLoss', 'Stop', stopLoss, `brokenLevel ${dir === 'long' ? '−' : '+'} 1.00 × ATR`, `${f(level)} ${dir === 'long' ? '−' : '+'} 1.00 × ${f(atr)} = ${f(stopLoss)}`,
      'A full ATR beyond the level — if price travels one average bar-range back through it, the break has failed'),
    d('takeProfit1', 'TP1', tp1, `entry ${sign} 1.5 × risk`, `${f(entry)} ${sign} 1.5 × ${f(risk)} = ${f(tp1)}`,
      'Fixed 1.5R first objective'),
    d('takeProfit2', 'TP2', tp2, useLiq ? 'nearest unswept liquidity level' : `entry ${sign} 2.4 × risk`,
      useLiq ? `= ${f(tp2)} (${targets[0].type.replace(/_/g, ' ')})` : `${f(entry)} ${sign} 2.4 × ${f(risk)} = ${f(tp2)}`,
      useLiq ? 'Continuation should run to the next resting liquidity pool' : 'No liquidity pool ≥1.6R in range — fixed 2.4R measured target'),
  ]

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
      qualityRule: `break-type table: CHOCH (trend change, fresher move) → 74 · BOS (continuation) → 66; this was a ${last.type} → ${last.type === 'CHOCH' ? 74 : 66}`,
      derivations,
      rationale: [
        `15m ${last.type} ${last.direction} through ${f(level)} ${barsAgo} bars ago; price is now retesting the broken level`,
        `Entry at the retest of ${f(level)} with the stop one full ATR beyond the level`,
      ],
      invalidation: `A 15m close back ${dir === 'long' ? 'below' : 'above'} ${f(level)} negates the break — stand down.`,
    },
  ]
}

// ── Liquidity-sweep reversal ──
// entry = current price after confirmed rejection (market)
// stop  = sweep extreme ∓ 0.25×ATR · TP1 = 1.5R · TP2 = liquidity ≥1.6R else 2.5R
function detectSweepReversal(ctx: SetupContext): DetectedSetup[] {
  const { view, candles, atr, pair } = ctx
  const sweep = view.recentSweeps.find((s) => s.reversed)
  if (!sweep) return []
  const barsAgo = candles.length - 1 - candles.findIndex((c) => c.time === sweep.time)
  if (barsAgo < 0 || barsAgo > 6) return []

  const dir: Direction = sweep.type === 'low_sweep' ? 'long' : 'short'
  const dg = pair.digits
  const f = (n: number) => n.toFixed(dg)
  const price = candles[candles.length - 1].close
  const entry = round(price, dg)
  const stopLoss = round(dir === 'long' ? sweep.price - atr * 0.25 : sweep.price + atr * 0.25, dg)
  const risk = Math.abs(entry - stopLoss)
  if (risk <= 0 || risk > atr * 2) return []

  const targets = getTargetLiquidity(price, view.keyLevels, dir === 'long' ? 'bullish' : 'bearish')
  const tp1 = round(dir === 'long' ? entry + risk * 1.5 : entry - risk * 1.5, dg)
  const useLiq = Boolean(targets[0] && Math.abs(targets[0].price - entry) > risk * 1.6)
  const tp2 = round(useLiq ? targets[0].price : dir === 'long' ? entry + risk * 2.5 : entry - risk * 2.5, dg)

  const counterTrend = view.htfBias !== 'neutral' && (dir === 'long') !== (view.htfBias === 'bullish')
  const sign = dir === 'long' ? '+' : '−'
  const derivations: LevelDerivation[] = [
    d('entry', 'Entry', entry, 'close of confirmation bar (market)', `= ${f(entry)}`,
      `The sweep of ${f(sweep.level.price)} already rejected (${sweep.pipsSwept.toFixed(1)}p through, closed back inside) — waiting for a pullback risks missing the reversal, so execution is at market`),
    d('stopLoss', 'Stop', stopLoss, `sweepExtreme ${dir === 'long' ? '−' : '+'} 0.25 × ATR`, `${f(sweep.price)} ${dir === 'long' ? '−' : '+'} 0.25 × ${f(atr)} = ${f(stopLoss)}`,
      'The sweep wick is the exact liquidity extreme; a second run through it voids the reversal, so only a quarter-ATR buffer is needed'),
    d('takeProfit1', 'TP1', tp1, `entry ${sign} 1.5 × risk`, `${f(entry)} ${sign} 1.5 × ${f(risk)} = ${f(tp1)}`,
      'Fixed 1.5R first objective'),
    d('takeProfit2', 'TP2', tp2, useLiq ? 'opposing unswept liquidity level' : `entry ${sign} 2.5 × risk`,
      useLiq ? `= ${f(tp2)} (${targets[0].type.replace(/_/g, ' ')})` : `${f(entry)} ${sign} 2.5 × ${f(risk)} = ${f(tp2)}`,
      useLiq ? 'After a sweep, price typically rotates to the opposite liquidity pool' : 'No opposing pool ≥1.6R — fixed 2.5R measured target'),
  ]

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
      qualityRule: `confirmed sweep base 76; counter-trend against 4H bias → −18 ⇒ ${counterTrend ? 58 : 76}${counterTrend ? '' : ' (aligned, no deduction)'}`,
      derivations,
      rationale: [
        `${sweep.type === 'low_sweep' ? 'Sell-side' : 'Buy-side'} liquidity swept at ${f(sweep.level.price)} (${sweep.pipsSwept.toFixed(1)} pips through the level) with confirmed rejection`,
        `Stop tucked ${dir === 'long' ? 'below' : 'above'} the sweep extreme at ${f(sweep.price)}`,
        counterTrend
          ? 'Counter to higher-timeframe bias — reduced quality, tighter management'
          : 'Sweep occurred in the direction of the higher-timeframe bias',
      ],
      invalidation: `A second sweep of ${f(sweep.price)} without reclaim means the level is being run — the reversal premise is dead.`,
    },
  ]
}

// ── Range fade ──
// Only when HTF is neutral and regime is ranging/quiet.
// entry = market at the extreme · stop = extreme ∓ 0.5×ATR
// TP1 = 50% of range · TP2 = far 15% band
function detectRangeFade(ctx: SetupContext): DetectedSetup[] {
  const { view, candles, atr, pair, regime } = ctx
  if (regime.tag !== 'ranging' && regime.tag !== 'quiet') return []
  if (view.htfBias !== 'neutral') return []

  const window = candles.slice(-48)
  const hi = Math.max(...window.map((c) => c.high))
  const lo = Math.min(...window.map((c) => c.low))
  const range = hi - lo
  if (range < atr * 2.5) return []

  const price = candles[candles.length - 1].close
  const pos = (price - lo) / range
  const dg = pair.digits
  const f = (n: number) => n.toFixed(dg)
  const qualityRule = 'flat 60: range fades are lowest-conviction (no directional edge, mid-range magnetism only)'

  if (pos >= 0.88) {
    const entry = round(price, dg)
    const stopLoss = round(hi + atr * 0.5, dg)
    const tp1 = round(lo + range * 0.5, dg)
    const tp2 = round(lo + range * 0.15, dg)
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
        qualityRule,
        derivations: [
          d('entry', 'Entry', entry, 'market at range extreme', `= ${f(entry)} (top ${Math.round((1 - pos) * 100)}% of range)`,
            `Price is in the top 12% of the 48-bar range ${f(lo)}–${f(hi)} with no HTF bias — fade toward the mean`),
          d('stopLoss', 'Stop', stopLoss, 'rangeHigh + 0.50 × ATR', `${f(hi)} + 0.50 × ${f(atr)} = ${f(stopLoss)}`,
            'A half-ATR beyond the range high — past it the range premise becomes a breakout'),
          d('takeProfit1', 'TP1', tp1, 'rangeLow + 0.50 × range', `${f(lo)} + 0.50 × ${f(range)} = ${f(tp1)}`,
            'The range midpoint — the mean price gravitates to inside a range'),
          d('takeProfit2', 'TP2', tp2, 'rangeLow + 0.15 × range', `${f(lo)} + 0.15 × ${f(range)} = ${f(tp2)}`,
            'The far 15% band — full rotation target without demanding a perfect touch of the low'),
        ],
        rationale: [
          `No higher-timeframe bias; 48-bar range ${f(lo)}–${f(hi)} with price in the top ${Math.round((1 - pos) * 100)}%`,
          'Fading the range extreme back toward the mid',
        ],
        invalidation: `Two consecutive 15m closes above ${f(hi)} converts the range to a breakout — do not fade.`,
      },
    ]
  }
  if (pos <= 0.12) {
    const entry = round(price, dg)
    const stopLoss = round(lo - atr * 0.5, dg)
    const tp1 = round(lo + range * 0.5, dg)
    const tp2 = round(lo + range * 0.85, dg)
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
        qualityRule,
        derivations: [
          d('entry', 'Entry', entry, 'market at range extreme', `= ${f(entry)} (bottom ${Math.round(pos * 100)}% of range)`,
            `Price is in the bottom 12% of the 48-bar range ${f(lo)}–${f(hi)} with no HTF bias — fade toward the mean`),
          d('stopLoss', 'Stop', stopLoss, 'rangeLow − 0.50 × ATR', `${f(lo)} − 0.50 × ${f(atr)} = ${f(stopLoss)}`,
            'A half-ATR beyond the range low — past it the range premise becomes a breakdown'),
          d('takeProfit1', 'TP1', tp1, 'rangeLow + 0.50 × range', `${f(lo)} + 0.50 × ${f(range)} = ${f(tp1)}`,
            'The range midpoint — the mean price gravitates to inside a range'),
          d('takeProfit2', 'TP2', tp2, 'rangeLow + 0.85 × range', `${f(lo)} + 0.85 × ${f(range)} = ${f(tp2)}`,
            'The far 15% band — full rotation target without demanding a perfect touch of the high'),
        ],
        rationale: [
          `No higher-timeframe bias; 48-bar range ${f(lo)}–${f(hi)} with price in the bottom ${Math.round(pos * 100)}%`,
          'Fading the range extreme back toward the mid',
        ],
        invalidation: `Two consecutive 15m closes below ${f(lo)} converts the range to a breakdown — do not fade.`,
      },
    ]
  }
  return []
}

// ─── helpers ─────────────────────────────────────────────────────────

function round(n: number, digits: number): number {
  return parseFloat(n.toFixed(digits))
}

function lastValid(series: number[]): number | undefined {
  for (let i = series.length - 1; i >= 0; i--) {
    if (!isNaN(series[i])) return series[i]
  }
  return undefined
}
