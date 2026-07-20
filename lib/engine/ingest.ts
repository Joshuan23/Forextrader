import { getCandles, getLiveRates } from '@/lib/data/provider'
import { getPairBySymbol } from '@/lib/forex/pairs'
import { getTargetLiquidity } from '@/lib/smc/liquidity'
import type { NormalizedAlert } from '@/lib/schemas/tradingview'
import type {
  DetectedSetup,
  EngineSignal,
  EntryType,
  FlowEdgeSettings,
  LevelDerivation,
} from './types'
import { HTF_CANDLE_COUNT, HTF_TIMEFRAME, SIGNAL_CANDLE_COUNT, SIGNAL_EXPIRY_BARS } from './config'
import { getSessionInfo } from './sessions'
import { classifyRegime } from './regime'
import { evaluateEventRisk, loadCalendarContext } from './events'
import { evaluateExecution } from './execution'
import { buildStructureView } from './structure'
import { scoreSetup } from './scoring'
import { buildExplanation, buildTradePlan } from './planner'
import { getProfile } from './profiles'
import { buildEdgeMap, lookupEdge } from './feedback'
import type { JournalRecord } from './expectancy'

// Ingestion of a TradingView alert: the chart detected the setup; FlowEdge
// decides. We rebuild the level math deterministically from the payload's
// chart-native candidates, then run the identical context/scoring pipeline
// used by the internal scanner.

const TF_MS: Record<string, number> = {
  '1m': 60_000,
  '5m': 5 * 60_000,
  '15m': 15 * 60_000,
  '1h': 60 * 60_000,
  '4h': 4 * 60 * 60_000,
  '1d': 24 * 60 * 60_000,
}

const STOP_ATR_BUFFER = 0.25 // added beyond the chart's stop candidate
const STALE_BARS = 3 // alert older than this many bars → hard block

// Base technical quality per chart-native setup type (0–100 before context).
const TV_QUALITY_BASE: Record<NormalizedAlert['tvSetupType'], number> = {
  trend_pullback: 72,
  breakout_continuation: 68,
  session_breakout: 66,
  range_rejection: 62,
  // ICT: a sweep + market-structure-shift is a high-quality reversal read;
  // order-block / FVG mitigation are strong continuation reads.
  liquidity_sweep: 74,
  order_block: 70,
  fvg_mitigation: 68,
}

const TV_ENTRY_TYPE: Record<NormalizedAlert['tvSetupType'], EntryType> = {
  trend_pullback: 'limit',
  breakout_continuation: 'stop',
  session_breakout: 'stop',
  range_rejection: 'market',
  // ICT entries fire on the shift close (market) or a limit back into the zone.
  liquidity_sweep: 'market',
  order_block: 'limit',
  fvg_mitigation: 'limit',
}

export async function ingestTradingViewAlert(
  alert: NormalizedAlert,
  settings: FlowEdgeSettings,
  journal: JournalRecord[],
  now = Date.now()
): Promise<EngineSignal> {
  const pair = getPairBySymbol(alert.symbol)
  if (!pair) throw new Error(`Pair ${alert.symbol} not configured`)
  const dg = pair.digits
  const f = (n: number) => n.toFixed(dg)
  const dir = alert.direction
  const sign = dir === 'long' ? 1 : -1
  const signCh = dir === 'long' ? '+' : '−'

  // ── App-side context (identical pipeline to the internal scanner) ──
  const [signalData, htfData, rates, calendar] = await Promise.all([
    getCandles(alert.symbol, alert.timeframe, SIGNAL_CANDLE_COUNT),
    getCandles(alert.symbol, HTF_TIMEFRAME, HTF_CANDLE_COUNT),
    getLiveRates([alert.symbol]),
    loadCalendarContext(now),
  ])
  const rate = rates[alert.symbol]
  const spreadPips = rate ? (rate.ask - rate.bid) / pair.pipSize : pair.spread
  const price = rate?.mid ?? alert.close

  const profile = getProfile(settings.activeProfileId)
  const session = getSessionInfo(new Date(now))
  const regime = classifyRegime(signalData.candles, pair.pipSize)
  const eventRisk = evaluateEventRisk(alert.symbol, calendar, settings)
  // Real broker fill metrics when recorded; conservative model otherwise.
  const { loadRealSlippage } = await import('@/lib/services/execution-metrics')
  const realSlippage = await loadRealSlippage(alert.symbol, session.tag)
  const execution = evaluateExecution(
    pair, spreadPips, regime.atrPips, session.tag, settings, profile.maxSpreadOverride, realSlippage
  )
  const view = buildStructureView(signalData.candles, htfData.candles, alert.symbol)
  const edgeMap = buildEdgeMap(journal)

  // ── Deterministic level math from the chart-native candidates ──
  const atr = alert.atr // the ATR of the chart that produced the setup
  const entry = round(alert.entryCandidate, dg)
  const stopLoss = round(alert.stopCandidate - sign * STOP_ATR_BUFFER * atr, dg)
  const risk = Math.abs(entry - stopLoss)

  // TP1: snap to the chart's swing objective when it lies in [0.8R, 1.6R];
  // otherwise a fixed 1R first target.
  const swingTarget = dir === 'long' ? alert.swingHigh : alert.swingLow
  const swingDist = sign * (swingTarget - entry)
  const snapTp1 = swingDist >= risk * 0.8 && swingDist <= risk * 1.6
  const tp1 = round(snapTp1 ? swingTarget : entry + sign * risk, dg)

  // TP2: the chart's TP candidate if ≥1.6R away; else our own nearest
  // unswept liquidity ≥1.6R; else a fixed 2.4R measured target.
  const tvTpDist = alert.tpCandidate !== undefined ? sign * (alert.tpCandidate - entry) : -1
  const liq = getTargetLiquidity(price, view.keyLevels, dir === 'long' ? 'bullish' : 'bearish')[0]
  const liqDist = liq ? sign * (liq.price - entry) : -1
  let tp2: number
  let tp2Formula: string
  let tp2Comp: string
  let tp2Reason: string
  if (alert.tpCandidate !== undefined && tvTpDist >= risk * 1.6) {
    tp2 = round(alert.tpCandidate, dg)
    tp2Formula = 'chart tpCandidate'
    tp2Comp = `= ${f(tp2)} (${(tvTpDist / risk).toFixed(2)}R)`
    tp2Reason = 'The chart-native structural target is ≥1.6R away, so it is honoured as TP2'
  } else if (liq && liqDist >= risk * 1.6) {
    tp2 = round(liq.price, dg)
    tp2Formula = 'nearest unswept liquidity level'
    tp2Comp = `= ${f(tp2)} (${liq.type.replace(/_/g, ' ')}, ${(liqDist / risk).toFixed(2)}R)`
    tp2Reason = 'App-side structure map holds a resting liquidity pool ≥1.6R away — price is drawn to it'
  } else {
    tp2 = round(entry + sign * risk * 2.4, dg)
    tp2Formula = `entry ${signCh} 2.4 × risk`
    tp2Comp = `${f(entry)} ${signCh} 2.4 × ${f(risk)} = ${f(tp2)}`
    tp2Reason = 'No structural target ≥1.6R in range (chart or app side) — fixed 2.4R measured target'
  }

  // TP3: runner for trend-following setups only.
  const isTrend = alert.tvSetupType === 'trend_pullback' || alert.tvSetupType === 'breakout_continuation'
  const tp3 = isTrend ? round(entry + sign * risk * 3.5, dg) : undefined

  // ── Technical quality: base table + chart-alignment bonuses ──
  const emaAligned = dir === 'long' ? alert.emaFast > alert.emaSlow : alert.emaFast < alert.emaSlow
  const rsiAligned =
    alert.rsi !== undefined &&
    (dir === 'long' ? alert.rsi >= 45 && alert.rsi <= 70 : alert.rsi >= 30 && alert.rsi <= 55)
  let quality = TV_QUALITY_BASE[alert.tvSetupType]
  const qualityParts = [`base ${quality} (${alert.tvSetupType.replace(/_/g, ' ')} table)`]
  if (emaAligned) {
    quality += 6
    qualityParts.push(`+6 (EMA${dir === 'long' ? ' fast > slow' : ' fast < slow'}: ${f(alert.emaFast)} vs ${f(alert.emaSlow)})`)
  }
  if (rsiAligned) {
    quality += 4
    qualityParts.push(`+4 (RSI ${alert.rsi!.toFixed(1)} in ${dir === 'long' ? '45–70' : '30–55'} band)`)
  }
  // ICT confluence stack: each confirmation the chart cleared (HTF bias,
  // FVG/displacement, discount/premium, RSI) adds quality, capped at +12.
  if (alert.confluenceScore && alert.confluenceScore > 0) {
    const bonus = Math.min(12, alert.confluenceScore * 3)
    quality += bonus
    const list = alert.confirmations ? ` — ${alert.confirmations.replace(/,+$/,'').replace(/,/g, ', ')}` : ''
    qualityParts.push(`+${bonus} (${alert.confluenceScore} ICT confluences${list})`)
  }
  quality = Math.min(90, quality)

  const derivations: LevelDerivation[] = [
    {
      key: 'entry', label: 'Entry', value: entry,
      formula: `chart entryCandidate (${TV_ENTRY_TYPE[alert.tvSetupType]})`,
      computation: `= ${f(entry)}`,
      reason: `TradingView detected the ${alert.tvSetupType.replace(/_/g, ' ')} at this level on the ${alert.timeframe} chart — the app validates context, it does not move the chart's entry`,
    },
    {
      key: 'stopLoss', label: 'Stop', value: stopLoss,
      formula: `chart stopCandidate ${dir === 'long' ? '−' : '+'} ${STOP_ATR_BUFFER} × ATR`,
      computation: `${f(alert.stopCandidate)} ${dir === 'long' ? '−' : '+'} ${STOP_ATR_BUFFER} × ${f(atr)} = ${f(stopLoss)}`,
      reason: 'The chart marks structure invalidation (swing); a quarter-ATR buffer absorbs spread and stop-hunt wicks beyond it',
    },
    {
      key: 'takeProfit1', label: 'TP1', value: tp1,
      formula: snapTp1 ? `swing${dir === 'long' ? 'High' : 'Low'} (0.8–1.6R window)` : `entry ${signCh} 1.0 × risk`,
      computation: snapTp1
        ? `= ${f(tp1)} (${(swingDist / risk).toFixed(2)}R)`
        : `${f(entry)} ${signCh} 1.0 × ${f(risk)} = ${f(tp1)}`,
      reason: snapTp1
        ? 'The recent swing extreme sits inside the 0.8–1.6R window — the natural first liquidity objective'
        : `Swing extreme at ${f(swingTarget)} is outside the 0.8–1.6R window (${(swingDist / risk).toFixed(2)}R) — fixed 1R first target instead`,
    },
    { key: 'takeProfit2', label: 'TP2', value: tp2, formula: tp2Formula, computation: tp2Comp, reason: tp2Reason },
    ...(tp3 !== undefined
      ? [{
          key: 'takeProfit3' as const, label: 'TP3', value: tp3,
          formula: `entry ${signCh} 3.5 × risk`,
          computation: `${f(entry)} ${signCh} 3.5 × ${f(risk)} = ${f(tp3)}`,
          reason: 'Runner target — only attached to trend-following setups where continuation can extend',
        }]
      : []),
  ]

  const setup: DetectedSetup = {
    type: alert.setupType,
    direction: dir,
    entryType: TV_ENTRY_TYPE[alert.tvSetupType],
    entry,
    stopLoss,
    takeProfit1: tp1,
    takeProfit2: tp2,
    takeProfit3: tp3,
    quality,
    qualityRule: qualityParts.join(' ') + ` = ${quality} (cap 85 — chart signals never outrank full app-side setups)`,
    derivations,
    rationale: [
      `TradingView ${alert.tvSetupType.replace(/_/g, ' ')} on the ${alert.timeframe} chart (bar ${new Date(alert.barTime).toISOString().slice(11, 16)} UTC)`,
      `Chart context: close ${f(alert.close)}, EMA ${f(alert.emaFast)}/${f(alert.emaSlow)}${alert.rsi !== undefined ? `, RSI ${alert.rsi.toFixed(1)}` : ''}, swing ${f(alert.swingLow)}–${f(alert.swingHigh)}`,
    ],
    invalidation:
      dir === 'long'
        ? `A ${alert.timeframe} close below ${f(alert.stopCandidate)} (the chart's invalidation swing) kills the idea before entry.`
        : `A ${alert.timeframe} close above ${f(alert.stopCandidate)} (the chart's invalidation swing) kills the idea before entry.`,
  }

  // ── Score with the full context pipeline ──
  const edge = lookupEdge(edgeMap, setup.type, session.tag)
  const score = scoreSetup(setup, view, session, regime, eventRisk, execution, settings, profile, edge)
  const plan = buildTradePlan(setup, pair, price, execution, settings)

  // Kill-switch: stale alert (older than STALE_BARS bars).
  const ageMs = now - alert.signalTime
  const tfMs = TF_MS[alert.timeframe]
  if (ageMs > STALE_BARS * tfMs) {
    score.blockReasons.push(
      `Stale alert: ${Math.round(ageMs / 60000)}m old (> ${STALE_BARS} × ${alert.timeframe} bars) — chart context no longer current`
    )
    score.grade = 'blocked'
  }
  // Kill-switch: invalid reward-to-risk after costs.
  if (score.blockReasons.length === 0 && plan.riskReward < settings.minRiskReward) {
    score.blockReasons.push(
      `Net reward:risk to TP2 is ${plan.riskReward.toFixed(2)}R — below the ${settings.minRiskReward}R floor after spread and slippage`
    )
    score.grade = 'blocked'
  }

  const explanation = buildExplanation({
    setup, pair, grade: score.grade, confidence: score.confidence,
    view, session, regime, eventRisk, execution, plan, blockReasons: score.blockReasons,
  })

  return {
    id: `tv-${alert.symbol.replace('/', '')}-${alert.tvSetupType}-${alert.barTime}`,
    symbol: alert.symbol,
    pairName: pair.name,
    timeframe: alert.timeframe,
    price,
    digits: dg,
    direction: dir,
    entryType: setup.entryType,
    setupType: setup.type,
    grade: score.grade,
    confidence: score.confidence,
    confidenceEquation: score.confidenceEquation,
    status: score.blockReasons.length > 0 ? 'blocked' : 'approved',
    blockReasons: score.blockReasons,
    layerScores: score.layerScores,
    derivations,
    plan,
    explanation,
    session,
    regime,
    eventRisk,
    execution,
    htfBias: view.htfBias,
    spreadAtSignal: execution.spreadPips,
    atrAtSignal: atr,
    historicalEdge: edge,
    profileId: profile.id,
    createdAt: now,
    expiresAt: alert.signalTime + SIGNAL_EXPIRY_BARS * tfMs,
    dataSource: signalData.source,
    source: 'tradingview',
    tvSetupType: alert.tvSetupType,
    tvMode: alert.mode,
    chartUrl: alert.chartUrl,
    lifecycle: score.blockReasons.length > 0 ? 'blocked' : 'active',
  }
}

function round(n: number, digits: number): number {
  return parseFloat(n.toFixed(digits))
}
