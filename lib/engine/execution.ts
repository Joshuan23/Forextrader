import type { CurrencyPair } from '@/types/forex'
import type { ExecutionState, FlowEdgeSettings, SessionTag, SlippageProfile } from './types'

// Deterministic mock slippage profile per pair/session. Replaced by real
// ExecutionMetric rows (broker fill data) once collected in production.
export function getSlippageProfile(symbol: string, session: SessionTag): SlippageProfile {
  const seed = hash(`${symbol}:${session}`)
  const sessionFactor: Record<SessionTag, number> = {
    london_ny_overlap: 0.7,
    london: 0.8,
    newyork: 0.9,
    asia_london_overlap: 1.1,
    asia: 1.4,
    dead_zone: 2.2,
  }
  const base = 0.15 + (seed % 20) / 100 // 0.15–0.34 pips
  const factor = sessionFactor[session]
  const avgPips = round2(base * factor)
  return {
    avgPips,
    worstPips: round2(avgPips * (2.5 + (seed % 10) / 10)),
    fillQuality: round2(Math.min(0.99, 0.97 - (factor - 0.7) * 0.05)),
    sampleSize: 120 + (seed % 200),
  }
}

export function evaluateExecution(
  pair: CurrencyPair,
  liveSpreadPips: number,
  atrPips: number,
  session: SessionTag,
  settings: FlowEdgeSettings,
  overrideMaxSpreadPips?: number // stricter profile-level cap
): ExecutionState {
  const maxAllowed = Math.min(
    settings.maxSpreadPips[pair.symbol] ?? settings.maxSpreadPips['default'] ?? 2,
    overrideMaxSpreadPips ?? Number.POSITIVE_INFINITY
  )
  const typical = pair.spread
  const slippage = getSlippageProfile(pair.symbol, session)

  const ratio = typical > 0 ? liveSpreadPips / typical : 1
  const spreadState: ExecutionState['spreadState'] =
    ratio <= 1.1 ? 'tight' : ratio <= 1.8 ? 'normal' : 'wide'

  const estimatedCostPips = round2(liveSpreadPips + slippage.avgPips)
  const spreadPctOfAtr = atrPips > 0 ? Math.round((estimatedCostPips / atrPips) * 100) : 100

  const notes: string[] = []
  let ok = true
  if (liveSpreadPips > maxAllowed) {
    ok = false
    notes.push(`Spread ${liveSpreadPips.toFixed(1)}p exceeds limit ${maxAllowed.toFixed(1)}p`)
  }
  if (spreadState === 'wide') {
    notes.push(`Spread ${ratio.toFixed(1)}× typical — degraded execution`)
  }
  if (spreadPctOfAtr > 25) {
    ok = false
    notes.push(`Round-trip cost is ${spreadPctOfAtr}% of ATR — edge consumed by costs`)
  } else if (spreadPctOfAtr > 15) {
    notes.push(`Cost ${spreadPctOfAtr}% of ATR — thin margin over costs`)
  }
  if (notes.length === 0) notes.push('Execution conditions normal')

  return {
    spreadPips: round2(liveSpreadPips),
    typicalSpreadPips: typical,
    maxAllowedSpreadPips: maxAllowed,
    spreadState,
    slippage,
    spreadPctOfAtr,
    estimatedCostPips,
    ok,
    notes,
  }
}

export function executionScore(exec: ExecutionState): { score: number; note: string } {
  if (!exec.ok) return { score: 10, note: exec.notes[0] }
  let score = 100
  if (exec.spreadState === 'normal') score -= 10
  if (exec.spreadState === 'wide') score -= 45
  score -= Math.min(35, Math.max(0, exec.spreadPctOfAtr - 8) * 2)
  score -= Math.min(15, exec.slippage.avgPips * 20)
  return { score: Math.max(0, Math.round(score)), note: exec.notes[0] }
}

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0
  }
  return h
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
