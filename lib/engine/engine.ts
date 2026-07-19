import { getCandles, getLiveRates } from '@/lib/data/provider'
import { getPairBySymbol } from '@/lib/forex/pairs'
import type { EngineSignal, FlowEdgeSettings, PairEvaluation } from './types'
import {
  HTF_CANDLE_COUNT,
  HTF_TIMEFRAME,
  SIGNAL_CANDLE_COUNT,
  SIGNAL_EXPIRY_BARS,
  SIGNAL_TIMEFRAME,
} from './config'
import { getSessionInfo } from './sessions'
import { classifyRegime } from './regime'
import { evaluateEventRisk, loadCalendarContext, type CalendarContext } from './events'
import { evaluateExecution } from './execution'
import { buildStructureView, detectSetups } from './structure'
import { scoreSetup } from './scoring'
import { buildExplanation, buildTradePlan } from './planner'
import { getProfile, type StrategyProfileDef } from './profiles'
import { buildEdgeMap, lookupEdge, type EdgeMap } from './feedback'
import type { JournalRecord } from './expectancy'

const TF_MS: Record<string, number> = {
  '1m': 60_000,
  '5m': 5 * 60_000,
  '15m': 15 * 60_000,
  '1h': 60 * 60_000,
  '4h': 4 * 60 * 60_000,
  '1d': 24 * 60 * 60_000,
}

export interface ScanContext {
  settings: FlowEdgeSettings
  calendar: CalendarContext
  profile: StrategyProfileDef
  edgeMap: EdgeMap
  now: number
}

// journal entries feed the expectancy/review layer (historical edge).
export async function createScanContext(
  settings: FlowEdgeSettings,
  journal: JournalRecord[] = []
): Promise<ScanContext> {
  const now = Date.now()
  const calendar = await loadCalendarContext(now)
  return {
    settings,
    calendar,
    profile: getProfile(settings.activeProfileId),
    edgeMap: buildEdgeMap(journal),
    now,
  }
}

// Evaluate one pair through every decision layer.
export async function evaluatePair(symbol: string, ctx: ScanContext): Promise<PairEvaluation | null> {
  const pair = getPairBySymbol(symbol)
  if (!pair) return null
  const { settings, profile, now } = ctx

  const [signalData, htfData, rates] = await Promise.all([
    getCandles(symbol, SIGNAL_TIMEFRAME, SIGNAL_CANDLE_COUNT),
    getCandles(symbol, HTF_TIMEFRAME, HTF_CANDLE_COUNT),
    getLiveRates([symbol]),
  ])

  const candles = signalData.candles
  if (candles.length < 60) return null
  const rate = rates[symbol]
  const price = rate?.mid ?? candles[candles.length - 1].close
  const spreadPips = rate ? (rate.ask - rate.bid) / pair.pipSize : pair.spread

  const session = getSessionInfo(new Date(now))
  const regime = classifyRegime(candles, pair.pipSize)
  const eventRisk = evaluateEventRisk(symbol, ctx.calendar, settings)
  // Real broker fill metrics when recorded; conservative model otherwise.
  const { loadRealSlippage } = await import('@/lib/services/execution-metrics')
  const realSlippage = await loadRealSlippage(symbol, session.tag)
  const execution = evaluateExecution(
    pair, spreadPips, regime.atrPips, session.tag, settings, profile.maxSpreadOverride, realSlippage
  )
  const view = buildStructureView(candles, htfData.candles, symbol)

  const allSetups = detectSetups({ pair, candles, view, regime, atr: regime.atr || price * 0.001 })
  // Strategy profile restricts which setup families may fire at all.
  const setups = allSetups.filter((s) => profile.setupTypes.includes(s.type))

  const signals: EngineSignal[] = []
  const blocked: EngineSignal[] = []

  for (const setup of setups) {
    const edge = lookupEdge(ctx.edgeMap, setup.type, session.tag)
    const score = scoreSetup(setup, view, session, regime, eventRisk, execution, settings, profile, edge)
    const plan = buildTradePlan(setup, pair, price, execution, settings)

    // Kill-switch: invalid reward-to-risk. A plan that cannot pay the
    // configured minimum to TP2 net of costs is never worth taking.
    if (score.blockReasons.length === 0 && plan.riskReward < settings.minRiskReward) {
      score.blockReasons.push(
        `Net reward:risk to TP2 is ${plan.riskReward.toFixed(2)}R — below the ${settings.minRiskReward}R floor after spread and slippage`
      )
      score.grade = 'blocked'
    }

    const explanation = buildExplanation({
      setup,
      pair,
      grade: score.grade,
      confidence: score.confidence,
      view,
      session,
      regime,
      eventRisk,
      execution,
      plan,
      blockReasons: score.blockReasons,
    })

    const signal: EngineSignal = {
      id: `fe-${symbol.replace('/', '')}-${setup.type}-${candles[candles.length - 1].time}`,
      symbol,
      pairName: pair.name,
      timeframe: SIGNAL_TIMEFRAME,
      price,
      digits: pair.digits,
      direction: setup.direction,
      entryType: setup.entryType,
      setupType: setup.type,
      grade: score.grade,
      confidence: score.confidence,
      confidenceEquation: score.confidenceEquation,
      status: score.blockReasons.length > 0 ? 'blocked' : 'approved',
      blockReasons: score.blockReasons,
      layerScores: score.layerScores,
      derivations: setup.derivations,
      plan,
      explanation,
      session,
      regime,
      eventRisk,
      execution,
      htfBias: view.htfBias,
      spreadAtSignal: execution.spreadPips,
      atrAtSignal: regime.atr,
      historicalEdge: edge,
      profileId: profile.id,
      createdAt: now,
      expiresAt: now + SIGNAL_EXPIRY_BARS * TF_MS[SIGNAL_TIMEFRAME],
      dataSource: signalData.source,
      source: 'engine',
    }

    if (signal.status === 'approved') signals.push(signal)
    else blocked.push(signal)
  }

  // ~24h change on the signal timeframe (96 × 15m bars).
  const back = candles[Math.max(0, candles.length - 97)]
  const changePct = back ? ((price - back.close) / back.close) * 100 : 0

  // Pair opportunity rank: best approved signal, else context ceiling.
  const contextCeiling = Math.round(
    (view.htfBiasScore + (session.marketOpen ? 60 : 0) + (execution.ok ? 60 : 20)) / 3
  )
  const rankScore =
    signals.length > 0
      ? Math.max(...signals.map((s) => s.confidence))
      : Math.min(contextCeiling, 49)

  return {
    symbol,
    pairName: pair.name,
    price,
    digits: pair.digits,
    changePct: Math.round(changePct * 100) / 100,
    dataSource: signalData.source,
    session,
    regime,
    eventRisk,
    execution,
    structure: view,
    candles,
    htfCandles: htfData.candles,
    signals,
    blocked,
    rankScore,
    evaluatedAt: now,
  }
}

// Scan the whole whitelist. Small batches to be polite to free providers.
export async function scanMarket(
  settings: FlowEdgeSettings,
  journal: JournalRecord[] = []
): Promise<PairEvaluation[]> {
  const ctx = await createScanContext(settings, journal)
  const results: PairEvaluation[] = []
  const batchSize = 3
  const symbols = settings.pairWhitelist
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize)
    const settled = await Promise.allSettled(batch.map((s) => evaluatePair(s, ctx)))
    for (const r of settled) {
      if (r.status === 'fulfilled' && r.value) results.push(r.value)
    }
  }
  return results.sort((a, b) => b.rankScore - a.rankScore)
}
