import { CURRENCY_PAIRS } from '@/lib/forex/pairs'
import type { EngineSignal, SignalLifecycle } from '@/lib/engine/types'

// Persistent store for signals that arrive via webhook (and any signal the
// user pins). Prisma-backed with DATABASE_URL; in-memory ring otherwise.
// The full EngineSignal (incl. derivations/layer scores) is kept so cards
// render identically for stored and freshly-scanned signals.
// Safely defers database access to avoid bundle issues in browser builds.

const MAX_MEMORY = 200
const globalStore = globalThis as unknown as { flowedgeSignals?: EngineSignal[] }

function memory(): EngineSignal[] {
  if (!globalStore.flowedgeSignals) globalStore.flowedgeSignals = []
  return globalStore.flowedgeSignals
}

export async function saveSignal(signal: EngineSignal): Promise<EngineSignal> {
  let db = null
  try {
    const { getDb } = await import('@/lib/db')
    db = getDb()
  } catch {
    // Ignore errors during build or in browser context
  }

  if (db) {
    const pairRow = await ensurePair(signal.symbol)
    await db.signal.upsert({
      where: { id: signal.id },
      update: { status: (signal.lifecycle === 'cancelled' ? 'invalid' : signal.lifecycle) ?? 'active' },
      create: {
        id: signal.id,
        pairId: pairRow.id,
        source: signal.source,
        timeframe: signal.timeframe,
        direction: signal.direction,
        entryType: signal.entryType,
        setupType: signal.setupType,
        profileId: signal.profileId,
        entry: signal.plan.entry,
        stopLoss: signal.plan.stopLoss,
        takeProfit1: signal.plan.takeProfit1,
        takeProfit2: signal.plan.takeProfit2,
        takeProfit3: signal.plan.takeProfit3,
        riskReward: signal.plan.riskReward,
        confidenceScore: signal.confidence,
        grade: signal.grade,
        regimeTag: signal.regime.tag,
        sessionTag: signal.session.tag,
        spreadAtSignal: signal.spreadAtSignal,
        atrAtSignal: signal.atrAtSignal,
        htfBias: signal.htfBias,
        eventRiskStatus: signal.eventRisk.level,
        status: signal.status === 'blocked' ? 'blocked' : 'active',
        explanation: signal.explanation,
        blockReasons: signal.blockReasons,
        layerScores: JSON.parse(JSON.stringify({
          layers: signal.layerScores,
          equation: signal.confidenceEquation,
          derivations: signal.derivations,
          full: signal, // complete render payload
        })),
        expiresAt: new Date(signal.expiresAt),
        tradePlan: {
          create: {
            entry: signal.plan.entry,
            stopLoss: signal.plan.stopLoss,
            takeProfit1: signal.plan.takeProfit1,
            takeProfit2: signal.plan.takeProfit2,
            takeProfit3: signal.plan.takeProfit3,
            riskReward: signal.plan.riskReward,
            invalidationLogic: signal.plan.invalidationLogic,
            managementPlan: signal.plan.managementPlan,
            riskPerTradePct: signal.plan.riskPerTradePct,
            positionSizeLots: signal.plan.positionSizeLots,
            checklist: signal.plan.checklist,
          },
        },
      },
    })
    return signal
  }
  const store = memory()
  const idx = store.findIndex((s) => s.id === signal.id)
  if (idx >= 0) store[idx] = signal
  else store.unshift(signal)
  if (store.length > MAX_MEMORY) store.length = MAX_MEMORY
  return signal
}

export async function listStoredSignals(limit = 50): Promise<EngineSignal[]> {
  let db = null
  try {
    const { getDb } = await import('@/lib/db')
    db = getDb()
  } catch {
    // Ignore errors during build or in browser context
  }

  if (db) {
    const rows = await db.signal.findMany({
      where: { source: 'tradingview' },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    return rows
      .map((r: typeof rows[number]): EngineSignal | null => {
        const payload = r.layerScores as { full?: EngineSignal } | null
        const full = payload?.full
        if (!full) return null
        return { ...full, lifecycle: r.status as SignalLifecycle }
      })
      .filter((s: EngineSignal | null): s is EngineSignal => s !== null)
  }
  return memory().slice(0, limit)
}

export async function resolveSignal(
  id: string,
  outcome: SignalLifecycle
): Promise<EngineSignal | null> {
  let db = null
  try {
    const { getDb } = await import('@/lib/db')
    db = getDb()
  } catch {
    // Ignore errors during build or in browser context
  }

  if (db) {
    const dbStatus = outcome === 'cancelled' ? 'invalid' : outcome
    const row = await db.signal
      .update({ where: { id }, data: { status: dbStatus } })
      .catch(() => null)
    if (!row) return null
    const payload = row.layerScores as { full?: EngineSignal } | null
    return payload?.full ? { ...payload.full, lifecycle: outcome } : null
  }
  const store = memory()
  const sig = store.find((s) => s.id === id)
  if (!sig) return null
  sig.lifecycle = outcome
  return sig
}

async function ensurePair(symbol: string) {
  const { getDb } = await import('@/lib/db')
  const db = getDb()
  if (!db) throw new Error('Database not available')
  const cfg = CURRENCY_PAIRS.find((p) => p.symbol === symbol)
  return db.pair.upsert({
    where: { symbol },
    update: {},
    create: {
      symbol,
      name: cfg?.name ?? symbol,
      base: cfg?.base ?? symbol.split('/')[0] ?? symbol,
      quote: cfg?.quote ?? symbol.split('/')[1] ?? 'USD',
      assetClass: cfg?.assetClass ?? 'forex',
      digits: cfg?.digits ?? 4,
      pipSize: cfg?.pipSize ?? 0.0001,
      typicalSpread: cfg?.spread ?? 1,
    },
  })
}
