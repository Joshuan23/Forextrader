import { getCandles } from '@/lib/data/provider'
import { resolveSignal } from '@/lib/store/signals'
import type { EngineSignal, SignalLifecycle } from '@/lib/engine/types'
import type { Timeframe } from '@/types/forex'

// Automatic signal-outcome resolution — the measurement half of the
// accuracy loop. Each run walks every ACTIVE stored signal forward through
// the candles printed since it fired and records what actually happened:
//   hit_tp2  — TP2 traded through (full win)
//   hit_tp1  — TP1 traded, then expiry/no TP2 before stop
//   stopped  — stop traded through (loss; conservative on ambiguous bars)
//   expired  — expiry passed without entry-side resolution
//
// CONSERVATIVE BAR RULE: when one bar spans both stop and target we cannot
// know intrabar order, so the stop wins. Reported stats therefore
// under-count wins rather than inflate them.

const TF_MS: Record<Timeframe, number> = {
  '1m': 60_000,
  '5m': 5 * 60_000,
  '15m': 15 * 60_000,
  '1h': 60 * 60_000,
  '4h': 4 * 60 * 60_000,
  '1d': 24 * 60 * 60_000,
}

interface ActiveRow {
  id: string
  symbol: string
  timeframe: Timeframe
  direction: 'long' | 'short'
  entry: number
  stopLoss: number
  takeProfit1: number
  takeProfit2: number
  createdAt: number
  expiresAt: number
}

async function listActiveRows(limit: number): Promise<ActiveRow[]> {
  let db = null
  try {
    const { getDb } = await import('@/lib/db')
    db = getDb()
  } catch {
    return []
  }
  if (!db) return []
  const rows = await db.signal.findMany({
    where: { status: 'active' },
    orderBy: { createdAt: 'asc' },
    take: limit,
  })
  return rows
    .map((r: { id: string; layerScores: unknown; status: string }): ActiveRow | null => {
      const full = (r.layerScores as { full?: EngineSignal } | null)?.full
      if (!full) return null
      return {
        id: full.id,
        symbol: full.symbol,
        timeframe: full.timeframe,
        direction: full.direction,
        entry: full.plan.entry,
        stopLoss: full.plan.stopLoss,
        takeProfit1: full.plan.takeProfit1,
        takeProfit2: full.plan.takeProfit2,
        createdAt: full.createdAt,
        expiresAt: full.expiresAt,
      }
    })
    .filter((r: ActiveRow | null): r is ActiveRow => r !== null)
}

function classify(row: ActiveRow, candles: { time: number; high: number; low: number }[], now: number): SignalLifecycle | null {
  const sign = row.direction === 'long' ? 1 : -1
  let tp1Hit = false
  for (const c of candles) {
    if (c.time <= row.createdAt) continue
    const stopHit = sign * (row.stopLoss - (row.direction === 'long' ? c.low : c.high)) >= 0
    const tp2Hit = sign * ((row.direction === 'long' ? c.high : c.low) - row.takeProfit2) >= 0
    const tp1Now = sign * ((row.direction === 'long' ? c.high : c.low) - row.takeProfit1) >= 0
    if (stopHit) return tp1Hit ? 'hit_tp1' : 'stopped' // TP1 banked before the stop ran
    if (tp2Hit) return 'hit_tp2'
    if (tp1Now) tp1Hit = true
  }
  if (now > row.expiresAt) return tp1Hit ? 'hit_tp1' : 'expired'
  return null // still open — keep watching
}

export interface OutcomeSweepResult {
  checked: number
  resolved: { id: string; symbol: string; outcome: SignalLifecycle }[]
  errors: string[]
}

export async function resolveOutcomes(limit = 40, now = Date.now()): Promise<OutcomeSweepResult> {
  const active = await listActiveRows(limit)
  const resolved: OutcomeSweepResult['resolved'] = []
  const errors: string[] = []

  // One candle fetch per (symbol, timeframe) pair, not per signal.
  const groups = new Map<string, ActiveRow[]>()
  for (const row of active) {
    const key = `${row.symbol}|${row.timeframe}`
    groups.set(key, [...(groups.get(key) ?? []), row])
  }

  for (const [key, rows] of groups) {
    const [symbol, timeframe] = key.split('|') as [string, Timeframe]
    const oldest = Math.min(...rows.map((r) => r.createdAt))
    const barsSince = Math.ceil((now - oldest) / TF_MS[timeframe]) + 5
    const count = Math.min(Math.max(barsSince, 10), 1000)
    try {
      const { candles } = await getCandles(symbol, timeframe, count)
      for (const row of rows) {
        const outcome = classify(row, candles, now)
        if (!outcome) continue
        await resolveSignal(row.id, outcome)
        resolved.push({ id: row.id, symbol, outcome })
      }
    } catch (e) {
      errors.push(`${key}: ${e instanceof Error ? e.message : 'fetch failed'}`)
    }
  }

  return { checked: active.length, resolved, errors }
}
