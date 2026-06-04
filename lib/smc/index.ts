import type { Candle, Timeframe } from '@/types/forex'
import type { SMCAnalysis } from '@/types/smc'
import type { COTReport } from '@/types/cot'
import { detectSwingPoints, detectStructureBreaks, getMarketStructure } from './structure'
import { detectOrderBlocks } from './orderblocks'
import { detectFairValueGaps } from './fvg'
import { detectLiquidityLevels, detectLiquiditySweeps } from './liquidity'
import { generateSignals } from './signals'

export function analyzeSMC(pair: string, timeframe: Timeframe, candles: Candle[], cotReport?: COTReport): SMCAnalysis {
  // 1. Detect swing points
  const swingPoints = detectSwingPoints(candles)

  // 2. Detect structure breaks
  const structureBreaks = detectStructureBreaks(candles, swingPoints)

  // 3. Detect order blocks
  const orderBlocks = detectOrderBlocks(candles, pair)

  // 4. Detect fair value gaps
  const fairValueGaps = detectFairValueGaps(candles, pair)

  // 5. Detect liquidity levels
  const liquidityLevels = detectLiquidityLevels(candles, swingPoints, pair)

  // 6. Detect liquidity sweeps
  const sweeps = detectLiquiditySweeps(candles, liquidityLevels, pair)

  // 7. Get market structure
  const marketStructure = getMarketStructure(candles, swingPoints, structureBreaks)

  // Build partial analysis for signal generation (include candles for price reference)
  const partialAnalysis: SMCAnalysis = {
    pair,
    timeframe,
    analyzedAt: Date.now(),
    candles,
    swingPoints,
    structureBreaks,
    orderBlocks,
    fairValueGaps,
    liquidityLevels,
    sweeps,
    marketStructure,
    signals: [],
    cotReport,
  }

  // 8. Generate signals (with institutional COT context)
  const signals = generateSignals(partialAnalysis, cotReport)

  return {
    ...partialAnalysis,
    signals,
  }
}

// Re-export everything
export * from './structure'
export * from './orderblocks'
export * from './fvg'
export * from './liquidity'
export * from './signals'
