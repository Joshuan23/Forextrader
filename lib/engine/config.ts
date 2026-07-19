import type { FlowEdgeSettings } from './types'

// Institutional defaults per the FlowEdge product spec:
// weights 35/20/15/10/10/10, grade bands A≥85 / B≥70 / C≥60 / blocked <60.
export const DEFAULT_SETTINGS: FlowEdgeSettings = {
  pairWhitelist: ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD', 'XAU/USD'],
  maxSpreadPips: {
    default: 2.0,
    'EUR/USD': 1.2,
    'GBP/USD': 1.6,
    'USD/JPY': 1.5,
    'EUR/GBP': 1.8,
    'XAU/USD': 55,
  },
  minAtrPips: 6,
  maxAtrMultiple: 3,
  minRiskReward: 1.5, // net of costs, to TP2
  sessionFilters: {
    asia: true,
    london: true,
    newyork: true,
    london_ny_overlap: true,
    asia_london_overlap: true,
    dead_zone: false,
  },
  newsBlackoutBeforeMin: 30,
  newsBlackoutAfterMin: 15,
  centralBankDowngrade: true,
  riskPerTradePct: 0.5,
  accountCcy: 'USD',
  accountSize: 100_000,
  minConfidence: 60,
  activeProfileId: 'intraday-swing',
  signalWeights: {
    structure: 0.35, // technical setup quality
    htfBias: 0.2, // higher timeframe alignment
    session: 0.15, // session/liquidity quality
    regime: 0.1, // volatility fit
    eventRisk: 0.1, // event/news safety
    execution: 0.1, // spread/slippage
  },
  brokerAssumptions: {
    commissionPerLotUsd: 7,
    assumedSlippagePips: 0.3,
  },
}

// Output grading per spec: 85–100 A (full approval), 70–84 B (reduced size),
// 60–69 C (watch only), below 60 blocked.
export const GRADE_THRESHOLDS = { A: 85, B: 70, C: 60 } as const

export const SIGNAL_TIMEFRAME = '15m' as const
export const HTF_TIMEFRAME = '4h' as const
export const SIGNAL_CANDLE_COUNT = 240
export const HTF_CANDLE_COUNT = 200

// A signal is valid for this many signal-timeframe bars (15m × 6 = 90min).
export const SIGNAL_EXPIRY_BARS = 6

// Journal-feedback (historical edge) adjustments.
export const EDGE_MIN_SAMPLE = 10
export const EDGE_BOOST = 5 // expectancy ≥ +0.20R → +5 confidence
export const EDGE_PENALTY = -8 // expectancy ≤ −0.15R → −8 confidence
export const EDGE_BLOCK_EXPECTANCY = -0.4 // ≤ −0.40R with 15+ trades → hard block
export const EDGE_BLOCK_SAMPLE = 15
