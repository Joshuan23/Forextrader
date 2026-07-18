import { DEFAULT_SETTINGS } from '@/lib/engine/config'
import type { FlowEdgeSettings } from '@/lib/engine/types'

// Settings store — Prisma-backed when DATABASE_URL is set, otherwise an
// in-process singleton (survives the dev server session; resets on restart).
// Client components get defaults; server components can fetch from DB if configured.

const globalStore = globalThis as unknown as { flowedgeSettings?: FlowEdgeSettings }

// Check if we're in browser context - if so, never try to import db.ts
const isClient = typeof window !== 'undefined' || typeof process === 'undefined'

async function getDbSettings(): Promise<FlowEdgeSettings | null> {
  try {
    const { getDb } = await import('@/lib/db')
    const db = getDb()
    if (!db) return null

    const row = await db.userSettings.findUnique({ where: { id: 'default' } })
    if (row) {
      return {
        ...DEFAULT_SETTINGS,
        pairWhitelist: row.pairWhitelist,
        maxSpreadPips: row.maxSpreadPips as unknown as Record<string, number>,
        minAtrPips: row.minAtrPips,
        maxAtrMultiple: row.maxAtrMultiple,
        minRiskReward: row.minRiskReward,
        activeProfileId: row.activeProfileId,
        sessionFilters: row.sessionFilters as unknown as FlowEdgeSettings['sessionFilters'],
        newsBlackoutBeforeMin: row.newsBlackoutBeforeMin,
        newsBlackoutAfterMin: row.newsBlackoutAfterMin,
        centralBankDowngrade: row.centralBankDowngrade,
        riskPerTradePct: row.riskPerTradePct,
        accountCcy: row.accountCcy,
        accountSize: row.accountSize,
        minConfidence: row.minConfidence,
        signalWeights: row.signalWeights as unknown as FlowEdgeSettings['signalWeights'],
        brokerAssumptions: row.brokerAssumptions as unknown as FlowEdgeSettings['brokerAssumptions'],
      }
    }
  } catch {
    // Database not available or error reading
  }
  return null
}

export async function getSettings(): Promise<FlowEdgeSettings> {
  // Client-side or build time: return in-memory store or defaults
  if (isClient) {
    return globalStore.flowedgeSettings ?? DEFAULT_SETTINGS
  }

  // Server-side: try database first, fall back to in-memory
  const dbSettings = await getDbSettings()
  if (dbSettings) return dbSettings

  return globalStore.flowedgeSettings ?? DEFAULT_SETTINGS
}

export async function saveSettings(next: FlowEdgeSettings): Promise<void> {
  let db = null
  try {
    const { getDb } = await import('@/lib/db')
    db = getDb()
  } catch {
    // Ignore errors during build or in browser context
  }

  if (db) {
    await db.userSettings.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        pairWhitelist: next.pairWhitelist,
        maxSpreadPips: next.maxSpreadPips,
        minAtrPips: next.minAtrPips,
        maxAtrMultiple: next.maxAtrMultiple,
        minRiskReward: next.minRiskReward,
        activeProfileId: next.activeProfileId,
        sessionFilters: { ...next.sessionFilters },
        newsBlackoutBeforeMin: next.newsBlackoutBeforeMin,
        newsBlackoutAfterMin: next.newsBlackoutAfterMin,
        centralBankDowngrade: next.centralBankDowngrade,
        riskPerTradePct: next.riskPerTradePct,
        accountCcy: next.accountCcy,
        accountSize: next.accountSize,
        minConfidence: next.minConfidence,
        signalWeights: { ...next.signalWeights },
        brokerAssumptions: { ...next.brokerAssumptions },
      },
      update: {
        pairWhitelist: next.pairWhitelist,
        maxSpreadPips: next.maxSpreadPips,
        minAtrPips: next.minAtrPips,
        maxAtrMultiple: next.maxAtrMultiple,
        minRiskReward: next.minRiskReward,
        activeProfileId: next.activeProfileId,
        sessionFilters: { ...next.sessionFilters },
        newsBlackoutBeforeMin: next.newsBlackoutBeforeMin,
        newsBlackoutAfterMin: next.newsBlackoutAfterMin,
        centralBankDowngrade: next.centralBankDowngrade,
        riskPerTradePct: next.riskPerTradePct,
        accountCcy: next.accountCcy,
        accountSize: next.accountSize,
        minConfidence: next.minConfidence,
        signalWeights: { ...next.signalWeights },
        brokerAssumptions: { ...next.brokerAssumptions },
      },
    })
    return
  }
  globalStore.flowedgeSettings = next
}
