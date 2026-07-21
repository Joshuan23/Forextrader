import { NextResponse } from 'next/server'
import { errorResponse, requireRealData } from '@/lib/config/runtime'

export const dynamic = 'force-dynamic'

// GET /api/analytics/outcomes — realized signal performance from the
// resolved lifecycle of stored signals (hit_tp1 / hit_tp2 / stopped /
// expired), grouped overall, by setup type, and by grade. R multiples come
// from each signal's own stored levels:
//   hit_tp2 → +riskReward (full plan R)   hit_tp1 → +(tp1−entry)/risk
//   stopped → −1R                          expired → 0R (excluded from
//   win-rate, included in trade counts)

interface Row {
  status: string
  setupType: string
  grade: string
  direction: string
  entry: number
  stopLoss: number
  takeProfit1: number
  riskReward: number
}

interface Bucket {
  signals: number
  wins: number
  losses: number
  expired: number
  winRate: number
  expectancyR: number
}

function stats(rows: Row[]): Bucket {
  let wins = 0
  let losses = 0
  let expired = 0
  let totalR = 0
  for (const r of rows) {
    const risk = Math.abs(r.entry - r.stopLoss)
    const sign = r.direction === 'long' ? 1 : -1
    if (r.status === 'hit_tp2') {
      wins++
      totalR += r.riskReward
    } else if (r.status === 'hit_tp1') {
      wins++
      totalR += risk > 0 ? (sign * (r.takeProfit1 - r.entry)) / risk : 0
    } else if (r.status === 'stopped') {
      losses++
      totalR -= 1
    } else {
      expired++
    }
  }
  const decided = wins + losses
  return {
    signals: rows.length,
    wins,
    losses,
    expired,
    winRate: decided > 0 ? Math.round((wins / decided) * 1000) / 1000 : 0,
    expectancyR: rows.length > 0 ? Math.round((totalR / rows.length) * 100) / 100 : 0,
  }
}

export async function GET() {
  try {
    requireRealData('Outcome analytics')
    const { getDb } = await import('@/lib/db')
    const db = getDb()
    if (!db) {
      return NextResponse.json({ ok: true, resolved: 0, note: 'No database rows yet', overall: stats([]) })
    }

    const rows: Row[] = (
      await db.signal.findMany({
        where: { status: { in: ['hit_tp1', 'hit_tp2', 'stopped', 'expired'] } },
        orderBy: { createdAt: 'desc' },
        take: 1000,
      })
    ).map((r: Record<string, unknown>) => ({
      status: String(r.status),
      setupType: String(r.setupType),
      grade: String(r.grade),
      direction: String(r.direction),
      entry: Number(r.entry),
      stopLoss: Number(r.stopLoss),
      takeProfit1: Number(r.takeProfit1),
      riskReward: Number(r.riskReward),
    }))

    const groupBy = (key: (r: Row) => string) => {
      const out: Record<string, Bucket> = {}
      for (const r of rows) {
        const k = key(r)
        ;(out[k] ??= stats([])) // placeholder replaced below
      }
      for (const k of Object.keys(out)) out[k] = stats(rows.filter((r) => key(r) === k))
      return out
    }

    return NextResponse.json({
      ok: true,
      resolved: rows.length,
      overall: stats(rows),
      bySetup: groupBy((r) => r.setupType),
      byGrade: groupBy((r) => r.grade),
      note: 'Outcomes recorded by the automatic resolver with conservative ambiguous-bar handling (stop wins).',
    })
  } catch (e) {
    const { body, status } = errorResponse(e)
    return NextResponse.json(body, { status })
  }
}
