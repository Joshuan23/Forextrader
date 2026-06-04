import type { Candle } from '@/types/forex'
import type {
  SMCSignal,
  SMCAnalysis,
  OrderBlock,
  FairValueGap,
  LiquiditySweep,
  StructureBreak,
  TakeProfitLevel,
} from '@/types/smc'
import { CURRENCY_PAIRS } from '@/lib/forex/pairs'
import { findNearestOrderBlock } from './orderblocks'
import { findNearestFVG } from './fvg'
import { getTargetLiquidity } from './liquidity'

function candleMs(timeframe: string): number {
  switch (timeframe) {
    case '1m': return 60 * 1000
    case '5m': return 5 * 60 * 1000
    case '15m': return 15 * 60 * 1000
    case '1h': return 60 * 60 * 1000
    case '4h': return 4 * 60 * 60 * 1000
    case '1d': return 24 * 60 * 60 * 1000
    default: return 60 * 60 * 1000
  }
}

function scoreSetup(
  direction: 'bullish' | 'bearish',
  analysis: SMCAnalysis,
  ob: OrderBlock | null,
  fvg: FairValueGap | null,
  recentSweep: LiquiditySweep | null,
  recentCHOCH: StructureBreak | null,
  currentPrice: number
): number {
  let score = 0
  const { marketStructure } = analysis

  // HTF bias scoring
  if (marketStructure.bias === direction) {
    score += 20
  } else if (marketStructure.bias === 'ranging') {
    score += 5
  } else {
    score -= 10
  }

  // Recent sweep scoring (last 8 candles)
  if (recentSweep) {
    if (
      (direction === 'bullish' && recentSweep.type === 'low_sweep') ||
      (direction === 'bearish' && recentSweep.type === 'high_sweep')
    ) {
      score += recentSweep.reversed ? 25 : 10
    }
  }

  // Recent CHOCH scoring (last 15 candles)
  if (recentCHOCH) {
    if (recentCHOCH.direction === direction) {
      score += 20
    }
  }

  // Price position scoring (discount for bullish, premium for bearish)
  const { fibLevel } = marketStructure
  if (direction === 'bullish' && fibLevel >= 50) {
    score += 10 // price in discount zone
  } else if (direction === 'bearish' && fibLevel <= 50) {
    score += 10 // price in premium zone
  }

  // Order block scoring
  if (ob) {
    if (ob.strength === 'strong') score += 20
    else if (ob.strength === 'medium') score += 12
    else score += 6
  }

  // FVG scoring
  if (fvg) {
    score += 15
  }

  return Math.max(0, Math.min(100, score))
}

function evaluateBullishSetup(analysis: SMCAnalysis): SMCSignal | null {
  const pairConfig = CURRENCY_PAIRS.find((p) => p.symbol === analysis.pair)
  const pipSize = pairConfig?.pipSize ?? 0.0001
  const digits = pairConfig?.digits ?? 5
  const candles = analysis.candles ?? []

  if (candles.length === 0) return null

  const currentPrice = candles[candles.length - 1].close
  const now = Date.now()

  // Find relevant OB and FVG
  const ob = findNearestOrderBlock(currentPrice, analysis.orderBlocks, 'bullish', pipSize)
  const fvg = findNearestFVG(currentPrice, analysis.fairValueGaps, 'bullish')

  // Check if entry zone exists near current price (within 50 pips)
  const maxDistance = 50 * pipSize
  const obNear = ob && currentPrice - ob.high <= maxDistance
  const fvgNear = fvg && currentPrice - fvg.top <= maxDistance

  if (!obNear && !fvgNear) return null

  // Determine entry price: prefer OB over FVG
  const entryPrice = ob && obNear ? ob.high : fvg!.top

  // Find recent sweep in last 8 candles
  const recentCandleTime = candles.length >= 8 ? candles[candles.length - 8].time : candles[0].time
  const recentSweep = analysis.sweeps
    .filter((s) => s.time >= recentCandleTime && s.type === 'low_sweep')
    .sort((a, b) => b.time - a.time)[0] ?? null

  // Find recent CHOCH in last 15 candles
  const recentCandleTime15 = candles.length >= 15 ? candles[candles.length - 15].time : candles[0].time
  const recentCHOCH = analysis.structureBreaks
    .filter((b) => b.time >= recentCandleTime15 && b.type === 'CHOCH' && b.direction === 'bullish')
    .sort((a, b) => b.time - a.time)[0] ?? null

  // Determine stop loss
  let slCandidates: number[] = []
  if (ob && obNear) slCandidates.push(ob.low - 5 * pipSize)
  if (recentSweep) slCandidates.push(recentSweep.price - 5 * pipSize)

  if (slCandidates.length === 0) {
    // Fallback: use recent swing low
    const recentLows = analysis.swingPoints
      .filter((s) => s.type === 'low' && s.price < entryPrice)
      .sort((a, b) => b.time - a.time)
    if (recentLows.length > 0) {
      slCandidates.push(recentLows[0].price - 5 * pipSize)
    } else {
      slCandidates.push(entryPrice - 20 * pipSize)
    }
  }

  const stopLoss = Math.min(...slCandidates)
  const riskPips = (entryPrice - stopLoss) / pipSize

  // Validate risk range
  if (riskPips < 5 || riskPips > 100) return null

  // Calculate take profits from liquidity targets
  const targetLevels = getTargetLiquidity(currentPrice, analysis.liquidityLevels, 'bullish')
  const takeProfits: TakeProfitLevel[] = []

  for (let idx = 0; idx < targetLevels.length; idx++) {
    const tpPrice = targetLevels[idx].price
    const rewardPips = (tpPrice - entryPrice) / pipSize
    const rr = rewardPips / riskPips
    if (rr >= 1) {
      takeProfits.push({
        price: parseFloat(tpPrice.toFixed(digits)),
        label: `TP${idx + 1}`,
        rr: parseFloat(rr.toFixed(2)),
      })
    }
  }

  // Fallback TPs if not enough from liquidity
  if (takeProfits.length === 0) {
    takeProfits.push({
      price: parseFloat((entryPrice + riskPips * 2 * pipSize).toFixed(digits)),
      label: 'TP1',
      rr: 2,
    })
  }
  if (takeProfits.length === 1) {
    takeProfits.push({
      price: parseFloat((entryPrice + riskPips * 3 * pipSize).toFixed(digits)),
      label: 'TP2',
      rr: 3,
    })
  }

  const primaryRR = takeProfits[0].rr

  // Must have R:R >= 1
  if (primaryRR < 1) return null

  const score = scoreSetup('bullish', analysis, ob && obNear ? ob : null, fvg && fvgNear ? fvg : null, recentSweep, recentCHOCH, currentPrice)
  const confidence = score >= 65 ? 'high' : score >= 40 ? 'medium' : 'low'

  // Build triggers list
  const triggers: string[] = []
  if (analysis.marketStructure.bias === 'bullish') triggers.push('Bullish market structure')
  if (analysis.marketStructure.bias === 'ranging') triggers.push('Ranging market (neutral bias)')
  if (recentCHOCH) triggers.push('Recent bullish CHOCH (market reversal)')
  if (recentSweep) triggers.push(recentSweep.reversed ? 'Liquidity sweep with reversal' : 'Liquidity sweep detected')
  if (ob && obNear) triggers.push(`Bullish order block (${ob.strength} strength)`)
  if (fvg && fvgNear) triggers.push(`Bullish FVG (${fvg.sizeInPips.toFixed(1)} pips)`)
  if (analysis.marketStructure.fibLevel >= 50) triggers.push('Price in discount zone')

  return {
    id: `smc-buy-${analysis.pair}-${now}`,
    pair: analysis.pair,
    timeframe: analysis.timeframe,
    direction: 'buy',
    entry: parseFloat(entryPrice.toFixed(digits)),
    stopLoss: parseFloat(stopLoss.toFixed(digits)),
    takeProfits,
    riskPips: parseFloat(riskPips.toFixed(1)),
    primaryRR,
    confidence,
    score,
    triggers,
    timestamp: now,
    expiry: now + candleMs(analysis.timeframe) * 4,
    status: 'active',
    orderBlock: ob && obNear ? ob : undefined,
    fvg: fvg && fvgNear ? fvg : undefined,
    sweep: recentSweep ?? undefined,
    structureBreak: recentCHOCH ?? undefined,
  }
}

function evaluateBearishSetup(analysis: SMCAnalysis): SMCSignal | null {
  const pairConfig = CURRENCY_PAIRS.find((p) => p.symbol === analysis.pair)
  const pipSize = pairConfig?.pipSize ?? 0.0001
  const digits = pairConfig?.digits ?? 5
  const candles = analysis.candles ?? []

  if (candles.length === 0) return null

  const currentPrice = candles[candles.length - 1].close
  const now = Date.now()

  // Find relevant OB and FVG
  const ob = findNearestOrderBlock(currentPrice, analysis.orderBlocks, 'bearish', pipSize)
  const fvg = findNearestFVG(currentPrice, analysis.fairValueGaps, 'bearish')

  // Check if entry zone exists near current price (within 50 pips)
  const maxDistance = 50 * pipSize
  const obNear = ob && ob.low - currentPrice <= maxDistance
  const fvgNear = fvg && fvg.bottom - currentPrice <= maxDistance

  if (!obNear && !fvgNear) return null

  // Determine entry price: prefer OB over FVG
  const entryPrice = ob && obNear ? ob.low : fvg!.bottom

  // Find recent sweep in last 8 candles
  const recentCandleTime = candles.length >= 8 ? candles[candles.length - 8].time : candles[0].time
  const recentSweep = analysis.sweeps
    .filter((s) => s.time >= recentCandleTime && s.type === 'high_sweep')
    .sort((a, b) => b.time - a.time)[0] ?? null

  // Find recent CHOCH in last 15 candles
  const recentCandleTime15 = candles.length >= 15 ? candles[candles.length - 15].time : candles[0].time
  const recentCHOCH = analysis.structureBreaks
    .filter((b) => b.time >= recentCandleTime15 && b.type === 'CHOCH' && b.direction === 'bearish')
    .sort((a, b) => b.time - a.time)[0] ?? null

  // Determine stop loss
  let slCandidates: number[] = []
  if (ob && obNear) slCandidates.push(ob.high + 5 * pipSize)
  if (recentSweep) slCandidates.push(recentSweep.price + 5 * pipSize)

  if (slCandidates.length === 0) {
    // Fallback: use recent swing high
    const recentHighs = analysis.swingPoints
      .filter((s) => s.type === 'high' && s.price > entryPrice)
      .sort((a, b) => b.time - a.time)
    if (recentHighs.length > 0) {
      slCandidates.push(recentHighs[0].price + 5 * pipSize)
    } else {
      slCandidates.push(entryPrice + 20 * pipSize)
    }
  }

  const stopLoss = Math.max(...slCandidates)
  const riskPips = (stopLoss - entryPrice) / pipSize

  // Validate risk range
  if (riskPips < 5 || riskPips > 100) return null

  // Calculate take profits from liquidity targets
  const targetLevels = getTargetLiquidity(currentPrice, analysis.liquidityLevels, 'bearish')
  const takeProfits: TakeProfitLevel[] = []

  for (let idx = 0; idx < targetLevels.length; idx++) {
    const tpPrice = targetLevels[idx].price
    const rewardPips = (entryPrice - tpPrice) / pipSize
    const rr = rewardPips / riskPips
    if (rr >= 1) {
      takeProfits.push({
        price: parseFloat(tpPrice.toFixed(digits)),
        label: `TP${idx + 1}`,
        rr: parseFloat(rr.toFixed(2)),
      })
    }
  }

  // Fallback TPs if not enough from liquidity
  if (takeProfits.length === 0) {
    takeProfits.push({
      price: parseFloat((entryPrice - riskPips * 2 * pipSize).toFixed(digits)),
      label: 'TP1',
      rr: 2,
    })
  }
  if (takeProfits.length === 1) {
    takeProfits.push({
      price: parseFloat((entryPrice - riskPips * 3 * pipSize).toFixed(digits)),
      label: 'TP2',
      rr: 3,
    })
  }

  const primaryRR = takeProfits[0].rr

  // Must have R:R >= 1
  if (primaryRR < 1) return null

  const score = scoreSetup('bearish', analysis, ob && obNear ? ob : null, fvg && fvgNear ? fvg : null, recentSweep, recentCHOCH, currentPrice)
  const confidence = score >= 65 ? 'high' : score >= 40 ? 'medium' : 'low'

  // Build triggers list
  const triggers: string[] = []
  if (analysis.marketStructure.bias === 'bearish') triggers.push('Bearish market structure')
  if (analysis.marketStructure.bias === 'ranging') triggers.push('Ranging market (neutral bias)')
  if (recentCHOCH) triggers.push('Recent bearish CHOCH (market reversal)')
  if (recentSweep) triggers.push(recentSweep.reversed ? 'Liquidity sweep with reversal' : 'Liquidity sweep detected')
  if (ob && obNear) triggers.push(`Bearish order block (${ob.strength} strength)`)
  if (fvg && fvgNear) triggers.push(`Bearish FVG (${fvg.sizeInPips.toFixed(1)} pips)`)
  if (analysis.marketStructure.fibLevel <= 50) triggers.push('Price in premium zone')

  return {
    id: `smc-sell-${analysis.pair}-${now}`,
    pair: analysis.pair,
    timeframe: analysis.timeframe,
    direction: 'sell',
    entry: parseFloat(entryPrice.toFixed(digits)),
    stopLoss: parseFloat(stopLoss.toFixed(digits)),
    takeProfits,
    riskPips: parseFloat(riskPips.toFixed(1)),
    primaryRR,
    confidence,
    score,
    triggers,
    timestamp: now,
    expiry: now + candleMs(analysis.timeframe) * 4,
    status: 'active',
    orderBlock: ob && obNear ? ob : undefined,
    fvg: fvg && fvgNear ? fvg : undefined,
    sweep: recentSweep ?? undefined,
    structureBreak: recentCHOCH ?? undefined,
  }
}

export function generateSignals(analysis: SMCAnalysis): SMCSignal[] {
  const signals: SMCSignal[] = []

  const bullish = evaluateBullishSetup(analysis)
  if (bullish) signals.push(bullish)

  const bearish = evaluateBearishSetup(analysis)
  if (bearish) signals.push(bearish)

  return signals
}
