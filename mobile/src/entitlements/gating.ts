import { tierAtLeast, type Entitlement } from './types'

// Central gating rules — every UI lock and every data fetch limit goes
// through these, never through ad-hoc plan checks in components.

export const FREE_LIMITS = {
  fullSignalsPerDay: 1, // one un-blurred signal per day as a taste
  signalDelayMinutes: 60, // remaining signals visible but delayed + levels locked
  journalRows: 10,
  analyticsWindowDays: 7,
} as const

export const gates = {
  // levels & reasoning
  exactLevels: (e: Entitlement) => tierAtLeast(e, 'pro'),
  fullExplanations: (e: Entitlement) => tierAtLeast(e, 'pro'),
  deepReasoning: (e: Entitlement) => tierAtLeast(e, 'elite'), // layer rules + derivations
  // features
  fullJournal: (e: Entitlement) => tierAtLeast(e, 'pro'),
  standardAnalytics: (e: Entitlement) => tierAtLeast(e, 'pro'),
  advancedAnalytics: (e: Entitlement) => tierAtLeast(e, 'elite'), // edge reports, spread drag, session tops
  sessionFilters: (e: Entitlement) => tierAtLeast(e, 'pro'),
  premiumFilters: (e: Entitlement) => tierAtLeast(e, 'elite'),
  strategyProfiles: (e: Entitlement) => tierAtLeast(e, 'elite'),
  pushSignalAlerts: (e: Entitlement) => tierAtLeast(e, 'pro'),
  customAlerts: (e: Entitlement) => tierAtLeast(e, 'elite'),
} as const

export type GateKey = keyof typeof gates

// Which of today's signals a free user sees in full. Deterministic: the
// highest-confidence approved signal of the day is the free taste.
export function freeSignalAllowance<T extends { id: string; confidence: number; createdAt: number }>(
  signals: T[]
): Set<string> {
  const today = new Date().toISOString().slice(0, 10)
  const todays = signals.filter((s) => new Date(s.createdAt).toISOString().slice(0, 10) === today)
  const top = [...todays].sort((a, b) => b.confidence - a.confidence).slice(0, FREE_LIMITS.fullSignalsPerDay)
  return new Set(top.map((s) => s.id))
}
