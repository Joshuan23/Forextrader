import { env } from '@/lib/env'
import type { MobileSignal } from './types'
import { rebasedSamples } from './sample-signals'

// Typed API client. With EXPO_PUBLIC_FLOWEDGE_API_URL set it pulls the live
// scan from the FlowEdge web app; otherwise it serves the bundled samples
// (generated from the real engine) so the app is fully navigable offline.

interface ScanResponsePair {
  symbol: string
  signals: unknown[]
  blocked: { id: string }[]
}

export async function fetchSignals(): Promise<MobileSignal[]> {
  if (!env.apiUrl) return rebasedSamples()
  try {
    const res = await fetch(`${env.apiUrl}/api/scan`, { signal: AbortSignal.timeout(10_000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = (await res.json()) as { pairs: ScanResponsePair[] }
    const mapped = data.pairs.flatMap((p) => [
      ...(p.signals as Record<string, unknown>[]).map((s) => mapEngineSignal(s)),
    ])
    return mapped.length > 0 ? mapped : rebasedSamples()
  } catch {
    return rebasedSamples() // offline / API down → bundled data, never a dead app
  }
}

// EngineSignal (web) → MobileSignal
function mapEngineSignal(s: Record<string, unknown>): MobileSignal {
  const plan = s.plan as Record<string, number> & { invalidationLogic: string }
  const session = s.session as { tag: string }
  const regime = s.regime as { tag: string }
  const eventRisk = s.eventRisk as { level: string }
  return {
    id: String(s.id),
    pair: String(s.symbol),
    timeframe: String(s.timeframe),
    direction: s.direction as MobileSignal['direction'],
    setupType: String(s.setupType),
    entryType: String(s.entryType),
    grade: s.grade as MobileSignal['grade'],
    confidence: Number(s.confidence),
    status: s.status as MobileSignal['status'],
    session: session.tag,
    regime: regime.tag,
    htfBias: String(s.htfBias),
    eventRisk: eventRisk.level,
    spreadPips: Number(s.spreadAtSignal),
    entry: plan.entry,
    stopLoss: plan.stopLoss,
    takeProfit1: plan.takeProfit1,
    takeProfit2: plan.takeProfit2,
    takeProfit3: (plan.takeProfit3 as number | undefined) ?? null,
    rrTp1: plan.rrTp1,
    rrTp2: plan.riskReward,
    confidenceEquation: String(s.confidenceEquation ?? ''),
    blockReasons: (s.blockReasons as string[]) ?? [],
    invalidation: plan.invalidationLogic,
    explanation: String(s.explanation ?? ''),
    layerScores: ((s.layerScores as { label: string; score: number; rule: string }[]) ?? []).map(
      (l) => ({ label: l.label, score: l.score, rule: l.rule })
    ),
    derivations: ((s.derivations as { label: string; value: number; formula: string; computation: string }[]) ?? []).map(
      (d) => ({ level: d.label, value: d.value, formula: d.formula, computation: d.computation })
    ),
    createdAt: Number(s.createdAt),
    expiresAt: Number(s.expiresAt),
  }
}
