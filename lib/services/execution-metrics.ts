import type { SessionTag, SlippageProfile } from '@/lib/engine/types'

// Real execution metrics — broker fill data persisted in ExecutionMetric
// rows. When rows exist for a pair+session the engine scores execution on
// REAL slippage; otherwise it uses the deterministic conservative model in
// lib/engine/execution.ts, clearly labeled with sampleSize 0 by callers.

export async function loadRealSlippage(
  symbol: string,
  session: SessionTag
): Promise<SlippageProfile | null> {
  try {
    const { getDb } = await import('@/lib/db')
    const db = getDb()
    if (!db) return null
    const rows = (await db.executionMetric.findMany({
      where: { pair: { symbol }, sessionTag: session },
      orderBy: { capturedAt: 'desc' },
      take: 20,
    })) as {
      avgSlippagePips: number
      worstSlippagePips: number
      fillQuality: number
      sampleSize: number
    }[]
    if (rows.length === 0) return null

    const totalSamples = rows.reduce((s, r) => s + r.sampleSize, 0)
    if (totalSamples === 0) return null
    const wavg = (f: (r: (typeof rows)[number]) => number) =>
      rows.reduce((s, r) => s + f(r) * r.sampleSize, 0) / totalSamples

    return {
      avgPips: round2(wavg((r) => r.avgSlippagePips)),
      worstPips: round2(Math.max(...rows.map((r) => r.worstSlippagePips))),
      fillQuality: round2(wavg((r) => r.fillQuality)),
      sampleSize: totalSamples,
    }
  } catch {
    return null
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
