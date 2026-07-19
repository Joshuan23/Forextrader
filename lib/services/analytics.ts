import { listJournalEntries } from '@/lib/store/journal'
import { listStoredSignals } from '@/lib/store/signals'
import {
  computeExpectancy,
  equityCurveR,
  groupExpectancy,
  stayOutQuality,
  type ExpectancyStats,
  type GroupStats,
} from '@/lib/engine/expectancy'
import { SESSION_LABELS, SETUP_LABELS, type SessionTag, type SetupType } from '@/lib/engine/types'

// Analytics service — every number is computed from stored records
// (Prisma journal rows + persisted signals). Nothing here is hardcoded;
// the same formulas the feedback engine uses produce the API payloads.
//
// expectancy   = mean(resultR)  ≡  winRate·avgWin − lossRate·|avgLoss|
// profitFactor = grossProfit / |grossLoss|
// drawdown     = max peak-to-trough on the cumulative R curve
// stayOut      = good skips / skips, R saved by standing aside

export interface AnalyticsOverview {
  computedAt: string
  sample: { entries: number; closedTrades: number; skips: number }
  stats: ExpectancyStats
  stayOut: { skipped: number; goodSkips: number; quality: number; savedR: number }
  equityCurve: { time: number; equityR: number }[]
  gradePerformance: GroupStats[]
  winRateByPair: GroupStats[]
  blockedReasonFrequency: { reason: string; count: number }[]
}

export async function analyticsOverview(): Promise<AnalyticsOverview> {
  const entries = await listJournalEntries()
  const stats = computeExpectancy(entries)
  const stayOut = stayOutQuality(entries)

  // Blocked-reason frequency from persisted signals (real webhook history).
  const reasonCounts = new Map<string, number>()
  try {
    const stored = await listStoredSignals(500)
    for (const s of stored) {
      for (const r of s.blockReasons) {
        // Normalize numeric details so reasons aggregate ("ATR 4.2p below…" → "ATR below minimum")
        const key = normalizeReason(r)
        reasonCounts.set(key, (reasonCounts.get(key) ?? 0) + 1)
      }
    }
  } catch {
    // Signals store unavailable (e.g. schema not pushed yet) — journal analytics still valid.
  }

  return {
    computedAt: new Date().toISOString(),
    sample: {
      entries: entries.length,
      closedTrades: stats.trades,
      skips: entries.filter((e) => !e.taken).length,
    },
    stats,
    stayOut,
    equityCurve: equityCurveR(entries),
    gradePerformance: groupExpectancy(entries, (e) => e.grade, (g) => `Grade ${g}`),
    winRateByPair: groupExpectancy(entries, (e) => e.symbol, (s) => s),
    blockedReasonFrequency: [...reasonCounts.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20),
  }
}

export async function analyticsBySetup(): Promise<GroupStats[]> {
  const entries = await listJournalEntries()
  return groupExpectancy(entries, (e) => e.setupType, (k) => SETUP_LABELS[k as SetupType] ?? k)
}

export async function analyticsBySession(): Promise<GroupStats[]> {
  const entries = await listJournalEntries()
  return groupExpectancy(entries, (e) => e.sessionTag, (k) => SESSION_LABELS[k as SessionTag] ?? k)
}

function normalizeReason(r: string): string {
  return r
    .replace(/\d+(\.\d+)?/g, 'N')
    .replace(/\s+/g, ' ')
    .trim()
}
