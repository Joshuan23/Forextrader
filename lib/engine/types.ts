import type { Candle, Timeframe } from '@/types/forex'
import type { MarketStructure, OrderBlock, LiquidityLevel, LiquiditySweep, StructureBreak, SwingPoint } from '@/types/smc'

// ─── Core vocabulary ─────────────────────────────────────────────────

export type Direction = 'long' | 'short'
export type Grade = 'A' | 'B' | 'C' | 'blocked'
export type HtfBias = 'bullish' | 'bearish' | 'neutral'
export type MacroRisk = 'low' | 'medium' | 'high'

export type SessionTag =
  | 'asia'
  | 'london'
  | 'newyork'
  | 'london_ny_overlap'
  | 'asia_london_overlap'
  | 'dead_zone'

export type RegimeTag =
  | 'trending_up'
  | 'trending_down'
  | 'ranging'
  | 'volatile_expansion'
  | 'quiet'

export type SetupType =
  | 'pullback_continuation'
  | 'breakout_retest'
  | 'liquidity_sweep_reversal'
  | 'range_fade'
  | 'orderblock_mitigation'

export const SETUP_LABELS: Record<SetupType, string> = {
  pullback_continuation: 'Pullback Continuation',
  breakout_retest: 'Breakout & Retest',
  liquidity_sweep_reversal: 'Liquidity Sweep Reversal',
  range_fade: 'Range Fade',
  orderblock_mitigation: 'Order Block Mitigation',
}

export const SESSION_LABELS: Record<SessionTag, string> = {
  asia: 'Asia',
  london: 'London',
  newyork: 'New York',
  london_ny_overlap: 'London / NY Overlap',
  asia_london_overlap: 'Asia / London Overlap',
  dead_zone: 'Dead Zone',
}

export const MISTAKE_TAGS = [
  'chased_entry',
  'early_entry',
  'late_entry',
  'moved_stop',
  'oversized',
  'took_c_grade',
  'news_gamble',
  'cut_winner_early',
  'revenge_trade',
  'ignored_no_trade',
] as const

export const REGIME_LABELS: Record<RegimeTag, string> = {
  trending_up: 'Trending Up',
  trending_down: 'Trending Down',
  ranging: 'Ranging',
  volatile_expansion: 'Volatile Expansion',
  quiet: 'Quiet / Low Volatility',
}

// ─── Layer states ────────────────────────────────────────────────────

export interface SessionInfo {
  tag: SessionTag
  label: string
  activeSessions: string[]
  liquidity: 'low' | 'medium' | 'high'
  marketOpen: boolean
  minutesToNextChange: number
  nextChange: string // human label, e.g. "London open in 42m"
  utcHour: number
}

export interface EconomicEventLite {
  id: string
  title: string
  currency: string
  impact: MacroRisk
  scheduledAt: number // unix ms
  isCentralBank: boolean
  forecast?: string
  previous?: string
}

export interface EventRisk {
  level: MacroRisk
  inBlackout: boolean
  blackoutReason?: string
  centralBankDay: boolean
  nextHighImpact?: EconomicEventLite & { minutesTo: number }
  todaysEvents: EconomicEventLite[]
}

export interface RegimeState {
  tag: RegimeTag
  adx: number
  atr: number // price units (signal timeframe)
  atrPips: number
  atrPercentile: number // 0–100 vs trailing window
  medianAtrPips: number
  emaAligned: boolean
  description: string
}

export interface SlippageProfile {
  avgPips: number
  worstPips: number
  fillQuality: number // 0–1
  sampleSize: number
}

export interface ExecutionState {
  spreadPips: number
  typicalSpreadPips: number
  maxAllowedSpreadPips: number
  spreadState: 'tight' | 'normal' | 'wide'
  slippage: SlippageProfile
  spreadPctOfAtr: number // spread as % of ATR — cost sanity check
  estimatedCostPips: number // spread + expected slippage
  ok: boolean
  notes: string[]
}

export interface StructureView {
  htfBias: HtfBias
  htfBiasScore: number // 0–100 conviction
  htfNotes: string[]
  signalTf: MarketStructure
  swings: SwingPoint[]
  keyLevels: LiquidityLevel[]
  orderBlocks: OrderBlock[]
  recentBreaks: StructureBreak[]
  recentSweeps: LiquiditySweep[]
}

// ─── Setups & plans ──────────────────────────────────────────────────

export type EntryType = 'market' | 'limit' | 'stop'

// Full audit trail for one price level: the symbolic rule, the numeric
// substitution, and why that anchor was chosen. Every plan level has one.
export interface LevelDerivation {
  key: 'entry' | 'stopLoss' | 'takeProfit1' | 'takeProfit2' | 'takeProfit3'
  label: string
  value: number
  formula: string // symbolic, e.g. "swingHigh − 0.5 × leg"
  computation: string // numeric, e.g. "1.12500 − 0.5 × 0.00370 = 1.12315"
  reason: string // why this anchor
}

export interface DetectedSetup {
  type: SetupType
  direction: Direction
  entryType: EntryType
  entry: number
  stopLoss: number
  takeProfit1: number
  takeProfit2: number
  takeProfit3?: number
  quality: number // 0–100 technical quality before context filters
  qualityRule: string // exact rule that produced the quality number
  derivations: LevelDerivation[]
  rationale: string[]
  invalidation: string
}

export interface LayerScore {
  key: 'structure' | 'htfBias' | 'regime' | 'session' | 'execution' | 'eventRisk'
  label: string
  score: number // 0–100
  weight: number // 0–1, normalised
  note: string
  rule: string // exact rule + arithmetic that produced the score
}

export interface TradePlanDetail {
  entry: number
  stopLoss: number
  takeProfit1: number
  takeProfit2: number
  takeProfit3?: number
  riskPips: number
  riskReward: number // to TP2
  rrTp1: number
  positionSizeLots: number
  riskPerTradePct: number
  invalidationLogic: string
  managementPlan: string
  checklist: string[]
  rrComputation: string // exact cost-adjusted R:R arithmetic
  sizingComputation: string // exact position-size arithmetic
}

export interface EngineSignal {
  id: string
  symbol: string
  pairName: string
  timeframe: Timeframe
  price: number
  digits: number
  direction: Direction
  entryType: EntryType
  setupType: SetupType
  grade: Grade
  confidence: number // 0–100
  confidenceEquation: string // the exact weighted sum, substituted
  status: 'approved' | 'blocked'
  blockReasons: string[]
  layerScores: LayerScore[]
  derivations: LevelDerivation[]
  plan: TradePlanDetail
  explanation: string
  session: SessionInfo
  regime: RegimeState
  eventRisk: EventRisk
  execution: ExecutionState
  htfBias: HtfBias
  spreadAtSignal: number
  atrAtSignal: number
  historicalEdge?: HistoricalEdge
  profileId: string
  createdAt: number
  expiresAt: number
  dataSource: 'live' | 'simulated'
  // Signal origin: internal scanner or TradingView webhook
  source: 'engine' | 'tradingview'
  tvSetupType?: string // original chart-native setup name
  tvMode?: 'watchlist' | 'automation'
  chartUrl?: string
  lifecycle?: SignalLifecycle // stored signals only
}

export type SignalLifecycle =
  | 'active'
  | 'invalid'
  | 'hit_tp1'
  | 'hit_tp2'
  | 'stopped'
  | 'expired'
  | 'cancelled'
  | 'blocked'

// Journal-feedback layer: realised expectancy of this setup/session combo.
export interface HistoricalEdge {
  key: string // "setupType|sessionTag"
  trades: number
  expectancyR: number
  adjustment: number // confidence points applied (+boost / −penalty)
  blocked: boolean
  note: string
}

export interface PairEvaluation {
  symbol: string
  pairName: string
  price: number
  digits: number
  changePct: number
  dataSource: 'live' | 'simulated'
  session: SessionInfo
  regime: RegimeState
  eventRisk: EventRisk
  execution: ExecutionState
  structure: StructureView
  candles: Candle[] // signal timeframe, for charting
  htfCandles: Candle[]
  signals: EngineSignal[] // approved
  blocked: EngineSignal[] // evaluated but blocked, with reasons
  rankScore: number // 0–100 pair opportunity score for the ranking board
  evaluatedAt: number
}

// ─── Settings (mirrors prisma UserSettings) ──────────────────────────

export interface SignalWeights {
  structure: number
  htfBias: number
  regime: number
  session: number
  execution: number
  eventRisk: number
}

export interface FlowEdgeSettings {
  pairWhitelist: string[]
  maxSpreadPips: Record<string, number> // keyed by symbol, plus "default"
  minAtrPips: number
  maxAtrMultiple: number
  minRiskReward: number // net-of-costs floor to TP2
  activeProfileId: string
  sessionFilters: Record<SessionTag, boolean>
  newsBlackoutBeforeMin: number
  newsBlackoutAfterMin: number
  centralBankDowngrade: boolean
  riskPerTradePct: number
  accountCcy: string
  accountSize: number
  minConfidence: number
  signalWeights: SignalWeights
  brokerAssumptions: {
    commissionPerLotUsd: number
    assumedSlippagePips: number
  }
}
