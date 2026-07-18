import type {
  DetectedSetup,
  EventRisk,
  ExecutionState,
  FlowEdgeSettings,
  Grade,
  HistoricalEdge,
  LayerScore,
  RegimeState,
  SessionInfo,
  SignalWeights,
  StructureView,
} from './types'
import { REGIME_LABELS } from './types'
import { GRADE_THRESHOLDS } from './config'
import { SESSION_QUALITY } from './sessions'
import { eventRiskScore } from './events'
import { executionScore } from './execution'
import { regimeScore } from './regime'
import { applyWeightTilt, type StrategyProfileDef } from './profiles'

export interface ScoreResult {
  confidence: number
  grade: Grade
  layerScores: LayerScore[]
  blockReasons: string[]
}

// Hard kill-switches that block a signal regardless of weighted score.
// These implement "no signal fires without contextual validation".
export function hardBlockReasons(
  setup: DetectedSetup,
  view: StructureView,
  session: SessionInfo,
  eventRisk: EventRisk,
  execution: ExecutionState,
  regime: RegimeState,
  settings: FlowEdgeSettings,
  profile: StrategyProfileDef,
  edge?: HistoricalEdge
): string[] {
  const reasons: string[] = []
  if (!session.marketOpen) reasons.push('Market closed (weekend rollover)')
  if (!settings.sessionFilters[session.tag]) {
    reasons.push(`${session.label} session disabled by session filter`)
  }
  if (!profile.validSessions.includes(session.tag)) {
    reasons.push(`${session.label} is outside the "${profile.name}" profile's valid sessions`)
  }
  if (!profile.allowedRegimes.includes(regime.tag)) {
    reasons.push(`Regime "${REGIME_LABELS[regime.tag]}" not allowed by the "${profile.name}" profile`)
  }
  if (eventRisk.inBlackout) {
    reasons.push(eventRisk.blackoutReason ?? 'Inside news blackout window')
  }
  if (!execution.ok) {
    reasons.push(...execution.notes.filter((n) => n !== 'Execution conditions normal'))
  }
  const minAtr = Math.max(settings.minAtrPips, profile.minAtrPips ?? 0)
  if (regime.atrPips < minAtr) {
    reasons.push(
      `ATR ${regime.atrPips.toFixed(1)}p below minimum ${minAtr}p — market too quiet to pay for costs`
    )
  }
  if (regime.medianAtrPips > 0 && regime.atrPips > regime.medianAtrPips * settings.maxAtrMultiple) {
    reasons.push(
      `ATR ${regime.atrPips.toFixed(1)}p is ${(regime.atrPips / regime.medianAtrPips).toFixed(1)}× median — abnormal volatility, stops unreliable`
    )
  }
  // Conflicting higher-timeframe bias: only a confirmed liquidity-sweep
  // reversal qualifies as "exceptional reversal criteria".
  if (
    view.htfBias !== 'neutral' &&
    (setup.direction === 'long') !== (view.htfBias === 'bullish') &&
    setup.type !== 'liquidity_sweep_reversal'
  ) {
    reasons.push(`Conflicting higher-timeframe bias (${view.htfBias}) — counter-trend ${setup.type.replace(/_/g, ' ')} not permitted`)
  }
  if (edge?.blocked) {
    reasons.push(edge.note)
  }
  return reasons
}

export function scoreSetup(
  setup: DetectedSetup,
  view: StructureView,
  session: SessionInfo,
  regime: RegimeState,
  eventRisk: EventRisk,
  execution: ExecutionState,
  settings: FlowEdgeSettings,
  profile: StrategyProfileDef,
  edge?: HistoricalEdge
): ScoreResult {
  const w = normalizeWeights(applyWeightTilt(settings.signalWeights, profile.weightTilt))

  // HTF alignment for THIS setup's direction.
  let htfScore: number
  let htfNote: string
  if (view.htfBias === 'neutral') {
    htfScore = 50
    htfNote = 'No higher-timeframe bias — setup stands on its own'
  } else if ((setup.direction === 'long') === (view.htfBias === 'bullish')) {
    htfScore = view.htfBiasScore
    htfNote = `Trade direction aligned with ${view.htfBias} 4H bias`
  } else {
    htfScore = 28
    htfNote = `Counter-trend against ${view.htfBias} 4H bias`
  }

  const regimeRes = regimeScore(regime)
  // Mean-reversion setups actually prefer ranges; trend setups prefer trends.
  let regScore = regimeRes.score
  if (
    (setup.type === 'range_fade' || setup.type === 'liquidity_sweep_reversal') &&
    regime.tag === 'ranging'
  ) {
    regScore = 85
  }
  if (setup.type === 'range_fade' && (regime.tag === 'trending_up' || regime.tag === 'trending_down')) {
    regScore = 25
  }

  const sessScore = session.marketOpen ? SESSION_QUALITY[session.tag] : 0
  const execRes = executionScore(execution)
  const eventRes = eventRiskScore(eventRisk, settings)

  const layerScores: LayerScore[] = [
    { key: 'structure', label: 'Technical Structure', score: setup.quality, weight: w.structure, note: setup.rationale[0] },
    { key: 'htfBias', label: 'Higher-TF Bias', score: htfScore, weight: w.htfBias, note: htfNote },
    { key: 'regime', label: 'Volatility / Regime', score: regScore, weight: w.regime, note: regimeRes.note },
    { key: 'session', label: 'Session / Liquidity', score: sessScore, weight: w.session, note: `${session.label} — ${session.liquidity} liquidity` },
    { key: 'execution', label: 'Execution Quality', score: execRes.score, weight: w.execution, note: execRes.note },
    { key: 'eventRisk', label: 'Macro / Event Risk', score: eventRes.score, weight: w.eventRisk, note: eventRes.note },
  ]

  const weighted = layerScores.reduce((sum, l) => sum + l.score * l.weight, 0)
  // Journal-feedback adjustment (historical edge) applies on top of the
  // weighted layers, then clamp to 0–100.
  const confidence = Math.max(0, Math.min(100, Math.round(weighted + (edge?.adjustment ?? 0))))

  const blockReasons = hardBlockReasons(
    setup, view, session, eventRisk, execution, regime, settings, profile, edge
  )
  if (confidence < settings.minConfidence && blockReasons.length === 0) {
    blockReasons.push(
      `Confidence ${confidence} below minimum ${settings.minConfidence} — context does not support the setup`
    )
  }

  const grade: Grade =
    blockReasons.length > 0
      ? 'blocked'
      : confidence >= GRADE_THRESHOLDS.A
        ? 'A'
        : confidence >= GRADE_THRESHOLDS.B
          ? 'B'
          : 'C'

  return { confidence, grade, layerScores, blockReasons }
}

function normalizeWeights(weights: SignalWeights): SignalWeights {
  const total =
    weights.structure + weights.htfBias + weights.regime + weights.session + weights.execution + weights.eventRisk
  const t = total > 0 ? total : 1
  return {
    structure: weights.structure / t,
    htfBias: weights.htfBias / t,
    regime: weights.regime / t,
    session: weights.session / t,
    execution: weights.execution / t,
    eventRisk: weights.eventRisk / t,
  }
}
