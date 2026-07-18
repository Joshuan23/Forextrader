'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getSettings, saveSettings } from '@/lib/store/settings'
import { CURRENCY_PAIRS } from '@/lib/forex/pairs'
import type { SessionTag } from '@/lib/engine/types'

const SESSION_TAGS: SessionTag[] = [
  'asia',
  'london',
  'newyork',
  'london_ny_overlap',
  'asia_london_overlap',
  'dead_zone',
]

const schema = z.object({
  pairWhitelist: z.array(z.string()).min(1, 'Whitelist at least one pair'),
  defaultMaxSpread: z.number().min(0.1).max(200),
  minAtrPips: z.number().min(0).max(500),
  maxAtrMultiple: z.number().min(1).max(10),
  minRiskReward: z.number().min(0.5).max(10),
  activeProfileId: z.string().min(1),
  sessionFilters: z.record(z.string(), z.boolean()),
  newsBlackoutBeforeMin: z.number().int().min(0).max(240),
  newsBlackoutAfterMin: z.number().int().min(0).max(240),
  centralBankDowngrade: z.boolean(),
  riskPerTradePct: z.number().min(0.05).max(5),
  accountSize: z.number().min(100).max(100_000_000),
  minConfidence: z.number().int().min(0).max(100),
  weights: z.object({
    structure: z.number().min(0).max(1),
    htfBias: z.number().min(0).max(1),
    regime: z.number().min(0).max(1),
    session: z.number().min(0).max(1),
    execution: z.number().min(0).max(1),
    eventRisk: z.number().min(0).max(1),
  }),
  commissionPerLotUsd: z.number().min(0).max(100),
  assumedSlippagePips: z.number().min(0).max(20),
})

export type SettingsFormState = { ok: boolean; error?: string; savedAt?: number }

export async function updateSettings(
  _prev: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  const validSymbols = new Set(CURRENCY_PAIRS.map((p) => p.symbol))
  const raw = {
    pairWhitelist: formData.getAll('pairWhitelist').map(String).filter((s) => validSymbols.has(s)),
    defaultMaxSpread: num(formData, 'defaultMaxSpread', 2),
    minAtrPips: num(formData, 'minAtrPips', 6),
    maxAtrMultiple: num(formData, 'maxAtrMultiple', 3),
    minRiskReward: num(formData, 'minRiskReward', 1.5),
    activeProfileId: String(formData.get('activeProfileId') ?? 'intraday-swing'),
    sessionFilters: Object.fromEntries(
      SESSION_TAGS.map((t) => [t, formData.get(`session_${t}`) === 'on'])
    ),
    newsBlackoutBeforeMin: num(formData, 'newsBlackoutBeforeMin', 30),
    newsBlackoutAfterMin: num(formData, 'newsBlackoutAfterMin', 15),
    centralBankDowngrade: formData.get('centralBankDowngrade') === 'on',
    riskPerTradePct: num(formData, 'riskPerTradePct', 0.5),
    accountSize: num(formData, 'accountSize', 100000),
    minConfidence: num(formData, 'minConfidence', 50),
    weights: {
      structure: num(formData, 'w_structure', 0.28),
      htfBias: num(formData, 'w_htfBias', 0.2),
      regime: num(formData, 'w_regime', 0.12),
      session: num(formData, 'w_session', 0.14),
      execution: num(formData, 'w_execution', 0.12),
      eventRisk: num(formData, 'w_eventRisk', 0.14),
    },
    commissionPerLotUsd: num(formData, 'commissionPerLotUsd', 7),
    assumedSlippagePips: num(formData, 'assumedSlippagePips', 0.3),
  }

  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid settings' }
  }
  const v = parsed.data

  const current = await getSettings()
  await saveSettings({
    ...current,
    pairWhitelist: v.pairWhitelist,
    maxSpreadPips: { ...current.maxSpreadPips, default: v.defaultMaxSpread },
    minAtrPips: v.minAtrPips,
    maxAtrMultiple: v.maxAtrMultiple,
    minRiskReward: v.minRiskReward,
    activeProfileId: v.activeProfileId,
    sessionFilters: v.sessionFilters as Record<SessionTag, boolean>,
    newsBlackoutBeforeMin: v.newsBlackoutBeforeMin,
    newsBlackoutAfterMin: v.newsBlackoutAfterMin,
    centralBankDowngrade: v.centralBankDowngrade,
    riskPerTradePct: v.riskPerTradePct,
    accountSize: v.accountSize,
    minConfidence: v.minConfidence,
    signalWeights: v.weights,
    brokerAssumptions: {
      commissionPerLotUsd: v.commissionPerLotUsd,
      assumedSlippagePips: v.assumedSlippagePips,
    },
  })

  revalidatePath('/', 'layout')
  return { ok: true, savedAt: Date.now() }
}

function num(fd: FormData, key: string, fallback: number): number {
  const v = Number(fd.get(key))
  return Number.isFinite(v) ? v : fallback
}
