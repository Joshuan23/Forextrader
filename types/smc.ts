import type { Candle, OrderSide } from './forex'
import type { COTReport } from './cot'

export interface SwingPoint {
  index: number
  time: number
  price: number
  type: 'high' | 'low'
  significance: 'major' | 'minor'
}

export interface StructureBreak {
  time: number
  type: 'BOS' | 'CHOCH'
  direction: 'bullish' | 'bearish'
  brokenLevel: number
  candle: Candle
}

export interface OrderBlock {
  id: string
  time: number
  open: number
  high: number
  low: number
  close: number
  type: 'bullish' | 'bearish'
  mitigated: boolean
  mitigation: number
  strength: 'strong' | 'medium' | 'weak'
  impulseSize: number
}

export interface FairValueGap {
  id: string
  time: number
  top: number
  bottom: number
  mid: number
  type: 'bullish' | 'bearish'
  filled: boolean
  fillPercent: number
  sizeInPips: number
}

export interface LiquidityLevel {
  id: string
  time: number
  price: number
  type: 'equal_highs' | 'equal_lows' | 'swing_high' | 'swing_low' | 'session_high' | 'session_low'
  swept: boolean
  sweptTime?: number
  strength: number
}

export interface LiquiditySweep {
  time: number
  price: number
  type: 'high_sweep' | 'low_sweep'
  pipsSwept: number
  reversed: boolean
  level: LiquidityLevel
}

export type MarketBias = 'bullish' | 'bearish' | 'ranging'

export interface MarketStructure {
  bias: MarketBias
  lastBOS?: StructureBreak
  lastCHOCH?: StructureBreak
  currentLeg: 'impulse' | 'retracement'
  fibLevel: number
}

export type SignalConfidence = 'high' | 'medium' | 'low'

export interface TakeProfitLevel {
  price: number
  label: string
  rr: number
}

export interface SMCSignal {
  id: string
  pair: string
  timeframe: string
  direction: OrderSide
  entry: number
  stopLoss: number
  takeProfits: TakeProfitLevel[]
  riskPips: number
  primaryRR: number
  confidence: SignalConfidence
  score: number
  triggers: string[]
  timestamp: number
  expiry: number
  status: 'active' | 'triggered' | 'invalidated' | 'expired'
  orderBlock?: OrderBlock
  fvg?: FairValueGap
  sweep?: LiquiditySweep
  structureBreak?: StructureBreak
  cotAlignment?: 'aligned' | 'neutral' | 'opposed'
  cotScore?: number
}

export interface SMCAnalysis {
  pair: string
  timeframe: string
  analyzedAt: number
  candles?: Candle[]
  swingPoints: SwingPoint[]
  structureBreaks: StructureBreak[]
  orderBlocks: OrderBlock[]
  fairValueGaps: FairValueGap[]
  liquidityLevels: LiquidityLevel[]
  sweeps: LiquiditySweep[]
  marketStructure: MarketStructure
  signals: SMCSignal[]
  cotReport?: COTReport
}

export type { COTReport }
