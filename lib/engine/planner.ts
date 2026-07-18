import type { CurrencyPair } from '@/types/forex'
import type {
  DetectedSetup,
  EventRisk,
  ExecutionState,
  FlowEdgeSettings,
  Grade,
  RegimeState,
  SessionInfo,
  StructureView,
  TradePlanDetail,
} from './types'
import { SETUP_LABELS, SESSION_LABELS } from './types'

// Approximate USD pip value per standard lot for sizing. Assumes a USD
// account (configurable later via brokerAssumptions).
export function pipValuePerLotUsd(pair: CurrencyPair, price: number): number {
  const contract = pair.assetClass === 'forex' ? 100_000 : pair.assetClass === 'metal' ? 100 : 10
  if (pair.quote === 'USD') return pair.pipSize * contract
  if (price > 0) return (pair.pipSize * contract) / price
  return 10
}

export function buildTradePlan(
  setup: DetectedSetup,
  pair: CurrencyPair,
  price: number,
  execution: ExecutionState,
  settings: FlowEdgeSettings
): TradePlanDetail {
  const riskPips = Math.abs(setup.entry - setup.stopLoss) / pair.pipSize
  const rewardPipsTp1 = Math.abs(setup.takeProfit1 - setup.entry) / pair.pipSize
  const rewardPipsTp2 = Math.abs(setup.takeProfit2 - setup.entry) / pair.pipSize

  // Cost-adjusted R:R — spreads and expected slippage are paid on the way in.
  const cost = execution.estimatedCostPips
  const effectiveRisk = riskPips + cost
  const rrTp1 = effectiveRisk > 0 ? round2((rewardPipsTp1 - cost) / effectiveRisk) : 0
  const riskReward = effectiveRisk > 0 ? round2((rewardPipsTp2 - cost) / effectiveRisk) : 0

  const pipValue = pipValuePerLotUsd(pair, price)
  const riskUsd = settings.accountSize * (settings.riskPerTradePct / 100)
  const positionSizeLots =
    riskPips > 0 && pipValue > 0 ? round2(riskUsd / (riskPips * pipValue)) : 0

  const rrComputation =
    `cost = spread ${execution.spreadPips.toFixed(1)}p + slippage ${execution.slippage.avgPips.toFixed(2)}p = ${cost.toFixed(2)}p; ` +
    `RR(TP1) = (${rewardPipsTp1.toFixed(1)}p − ${cost.toFixed(2)}p) / (${riskPips.toFixed(1)}p + ${cost.toFixed(2)}p) = ${rrTp1}; ` +
    `RR(TP2) = (${rewardPipsTp2.toFixed(1)}p − ${cost.toFixed(2)}p) / (${riskPips.toFixed(1)}p + ${cost.toFixed(2)}p) = ${riskReward}`
  const sizingComputation =
    `risk = ${settings.riskPerTradePct}% × ${usd(settings.accountSize)} = ${usd(riskUsd)}; ` +
    `lots = ${usd(riskUsd)} / (${riskPips.toFixed(1)}p × $${pipValue.toFixed(2)}/pip/lot) = ${positionSizeLots}`

  const invalidationLogic = [
    setup.invalidation,
    `Skip if the spread widens above ${execution.maxAllowedSpreadPips.toFixed(1)}p before the fill.`,
    'Cancel the order if event risk rises into a blackout window.',
  ].join(' ')

  const managementPlan = [
    `Risk ${settings.riskPerTradePct}% (${usd(riskUsd)}) — ${positionSizeLots} lots at ${riskPips.toFixed(1)} pips of risk.`,
    `Take 50% off at TP1 (${rewardPipsTp1.toFixed(1)} pips, ${rrTp1}R net of costs) and move the stop to entry.`,
    `Run the remainder to TP2 (${rewardPipsTp2.toFixed(1)} pips, ${riskReward}R net of costs)${setup.takeProfit3 ? '; leave a runner for TP3 only if momentum is one-sided' : ''}.`,
    `If the position has not reached TP1 within 6 bars, treat the idea as stale and exit at market.`,
  ].join(' ')

  const checklist = [
    'Spread at or below the pair limit at the moment of entry',
    'No high-impact release inside the blackout window',
    'Entry order placed as a limit — never chase beyond the level',
    'Stop-loss order in the market before walking away',
    'Position size matches the computed lots — no discretionary sizing up',
  ]

  return {
    entry: setup.entry,
    stopLoss: setup.stopLoss,
    takeProfit1: setup.takeProfit1,
    takeProfit2: setup.takeProfit2,
    takeProfit3: setup.takeProfit3,
    riskPips: round2(riskPips),
    riskReward,
    rrTp1,
    positionSizeLots,
    riskPerTradePct: settings.riskPerTradePct,
    invalidationLogic,
    managementPlan,
    checklist,
    rrComputation,
    sizingComputation,
  }
}

// Plain-English narrative for the whole decision — required for every plan.
export function buildExplanation(args: {
  setup: DetectedSetup
  pair: CurrencyPair
  grade: Grade
  confidence: number
  view: StructureView
  session: SessionInfo
  regime: RegimeState
  eventRisk: EventRisk
  execution: ExecutionState
  plan: TradePlanDetail
  blockReasons: string[]
}): string {
  const { setup, pair, grade, confidence, view, session, regime, eventRisk, execution, plan, blockReasons } = args
  const dir = setup.direction === 'long' ? 'Long' : 'Short'
  const d = pair.digits

  const parts: string[] = []
  parts.push(
    `${dir} ${pair.symbol} — ${SETUP_LABELS[setup.type]} (grade ${grade}, confidence ${confidence}/100).`
  )
  parts.push(...setup.rationale.map((r) => r + '.'))
  parts.push(
    `Plan: enter at ${setup.entry.toFixed(d)}, stop at ${setup.stopLoss.toFixed(d)} (${plan.riskPips.toFixed(1)} pips), TP1 ${setup.takeProfit1.toFixed(d)}, TP2 ${setup.takeProfit2.toFixed(d)}${setup.takeProfit3 ? `, TP3 ${setup.takeProfit3.toFixed(d)}` : ''} — ${plan.riskReward}R to TP2 after costs.`
  )
  parts.push(
    `Context: ${SESSION_LABELS[session.tag]} session with ${session.liquidity} liquidity; regime is ${regime.description.toLowerCase()}; spread ${execution.spreadPips.toFixed(1)}p (${execution.spreadState}).`
  )
  if (eventRisk.nextHighImpact) {
    parts.push(
      `Next high-impact event: ${eventRisk.nextHighImpact.title} (${eventRisk.nextHighImpact.currency}) in ${formatMin(eventRisk.nextHighImpact.minutesTo)}.`
    )
  }
  parts.push(`Invalidation: ${setup.invalidation}`)
  if (blockReasons.length > 0) {
    parts.push(`BLOCKED — ${blockReasons.join('; ')}.`)
  }
  return parts.join(' ')
}

function formatMin(mins: number): string {
  if (mins >= 60 * 24) return `${Math.round(mins / (60 * 24))}d`
  if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60}m`
  return `${mins}m`
}

function usd(n: number): string {
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
