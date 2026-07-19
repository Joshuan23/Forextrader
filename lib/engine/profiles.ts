import type { EntryType, RegimeTag, SessionTag, SetupType, SignalWeights } from './types'

// Strategy profiles — each defines where/when/what the engine is allowed
// to trade and how the layer weights tilt. The active profile is chosen
// in Settings; "intraday-swing" is the permissive default.

export interface StrategyProfileDef {
  id: string
  name: string
  description: string
  validSessions: SessionTag[]
  validPairs?: string[] // undefined → inherit whitelist
  setupTypes: SetupType[]
  allowedRegimes: RegimeTag[]
  minAtrPips?: number // override global when stricter
  maxSpreadOverride?: number // pips, overrides per-pair limit when stricter
  preferredEntry: EntryType
  weightTilt?: Partial<SignalWeights> // added to base weights, renormalised
  enabled: boolean
}

export const STRATEGY_PROFILES: StrategyProfileDef[] = [
  {
    id: 'intraday-swing',
    name: 'Intraday Swing',
    description: 'Default profile. All setups, all liquid sessions, structure-led.',
    validSessions: ['asia', 'london', 'newyork', 'london_ny_overlap', 'asia_london_overlap'],
    setupTypes: [
      'pullback_continuation',
      'orderblock_mitigation',
      'breakout_retest',
      'liquidity_sweep_reversal',
      'range_fade',
    ],
    allowedRegimes: ['trending_up', 'trending_down', 'ranging'],
    preferredEntry: 'limit',
    enabled: true,
  },
  {
    id: 'london-breakout',
    name: 'London Breakout',
    description: 'Trades the London-open expansion: breakout-retest only, London hours.',
    validSessions: ['asia_london_overlap', 'london'],
    setupTypes: ['breakout_retest'],
    allowedRegimes: ['trending_up', 'trending_down', 'ranging'],
    preferredEntry: 'stop',
    weightTilt: { session: 0.05, structure: 0.05 },
    enabled: true,
  },
  {
    id: 'ny-continuation',
    name: 'New York Continuation',
    description: 'Continuation of the London trend through the NY session and overlap.',
    validSessions: ['london_ny_overlap', 'newyork'],
    setupTypes: ['pullback_continuation', 'orderblock_mitigation'],
    allowedRegimes: ['trending_up', 'trending_down'],
    preferredEntry: 'limit',
    weightTilt: { htfBias: 0.05 },
    enabled: true,
  },
  {
    id: 'pullback-trend',
    name: 'Pullback in Trend',
    description: 'Only pullbacks aligned with a clear higher-timeframe trend.',
    validSessions: ['london', 'london_ny_overlap', 'newyork'],
    setupTypes: ['pullback_continuation', 'orderblock_mitigation'],
    allowedRegimes: ['trending_up', 'trending_down'],
    preferredEntry: 'limit',
    weightTilt: { structure: 0.05, htfBias: 0.05 },
    enabled: true,
  },
  {
    id: 'session-range-reversal',
    name: 'Session Range Reversal',
    description: 'Fades session-range extremes and confirmed liquidity sweeps in quiet regimes.',
    validSessions: ['asia', 'london'],
    setupTypes: ['range_fade', 'liquidity_sweep_reversal'],
    allowedRegimes: ['ranging', 'quiet'],
    preferredEntry: 'limit',
    weightTilt: { execution: 0.05 },
    enabled: true,
  },
  {
    id: 'scalping',
    name: 'Scalping (Overlap)',
    description: 'Overlap-only, tightest execution demands, sweep and retest entries.',
    validSessions: ['london_ny_overlap'],
    setupTypes: ['liquidity_sweep_reversal', 'breakout_retest'],
    allowedRegimes: ['trending_up', 'trending_down', 'ranging'],
    maxSpreadOverride: 1.0,
    preferredEntry: 'market',
    weightTilt: { execution: 0.1 },
    enabled: true,
  },
  {
    id: 'news-breakout',
    name: 'News Breakout',
    description: 'Trades post-release expansion. High risk — disabled by default.',
    validSessions: ['london', 'newyork', 'london_ny_overlap'],
    setupTypes: ['breakout_retest'],
    allowedRegimes: ['volatile_expansion', 'trending_up', 'trending_down'],
    preferredEntry: 'stop',
    enabled: false,
  },
]

export function getProfile(id: string): StrategyProfileDef {
  return (
    STRATEGY_PROFILES.find((p) => p.id === id && p.enabled) ??
    STRATEGY_PROFILES[0]
  )
}

export function applyWeightTilt(base: SignalWeights, tilt?: Partial<SignalWeights>): SignalWeights {
  if (!tilt) return base
  return {
    structure: base.structure + (tilt.structure ?? 0),
    htfBias: base.htfBias + (tilt.htfBias ?? 0),
    regime: base.regime + (tilt.regime ?? 0),
    session: base.session + (tilt.session ?? 0),
    execution: base.execution + (tilt.execution ?? 0),
    eventRisk: base.eventRisk + (tilt.eventRisk ?? 0),
  }
}
