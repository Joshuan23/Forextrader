import { env, isDemoMode } from '@/lib/env'
import type { MobileSignal } from './types'
import { rebasedSamples } from './sample-signals'

// Typed API client. Production policy: real backend data only.
// - EXPO_PUBLIC_FLOWEDGE_API_URL set → live signals, journal, analytics
//   from the FlowEdge backend (webhook-ingested + engine scan).
// - Not set → SetupError, unless EXPO_PUBLIC_DEMO_MODE=true, in which
//   case the bundled samples (generated from the real engine) are used.
// Fetch failures propagate to React Query error states — the app shows
// the problem, it does not silently render fake cards.

export class SetupError extends Error {
  readonly setup = true
  constructor(message: string) {
    super(message)
    this.name = 'SetupError'
  }
}

function requireApiUrl(): string {
  if (env.apiUrl) return env.apiUrl
  if (isDemoMode) return ''
  throw new SetupError(
    'EXPO_PUBLIC_FLOWEDGE_API_URL is not set. Point the app at your deployed FlowEdge backend, or set EXPO_PUBLIC_DEMO_MODE=true for an explicit demo build.'
  )
}

async function getJson<T>(path: string): Promise<T> {
  const base = requireApiUrl()
  const res = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(10_000) })
  const data = (await res.json().catch(() => null)) as ({ ok?: boolean; error?: string } & T) | null
  if (!res.ok || data === null || data.ok === false) {
    throw new Error(data?.error ?? `HTTP ${res.status}`)
  }
  return data
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const base = requireApiUrl()
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  })
  const data = (await res.json().catch(() => null)) as ({ ok?: boolean; error?: string } & T) | null
  if (!res.ok || data === null || data.ok === false) {
    throw new Error(data?.error ?? `HTTP ${res.status}`)
  }
  return data
}

// ── Signals ──────────────────────────────────────────────────────────

export async function fetchSignals(): Promise<MobileSignal[]> {
  if (!env.apiUrl && isDemoMode) return rebasedSamples()

  // Persisted TradingView signals (approved + blocked) plus live engine scan.
  const [inbox, scan] = await Promise.all([
    getJson<{ signals: Record<string, unknown>[] }>('/api/signals/inbox?limit=50'),
    getJson<{ pairs: { signals: unknown[] }[] }>('/api/scan').catch(() => ({ pairs: [] })),
  ])
  const stored = inbox.signals.map((s) => mapEngineSignal(s))
  const scanned = scan.pairs.flatMap((p) =>
    (p.signals as Record<string, unknown>[]).map((s) => mapEngineSignal(s))
  )
  // De-dupe by id, stored (persisted truth) wins.
  const seen = new Set(stored.map((s) => s.id))
  return [...stored, ...scanned.filter((s) => !seen.has(s.id))]
}

export async function fetchSignalById(id: string): Promise<MobileSignal | null> {
  if (!env.apiUrl && isDemoMode) return rebasedSamples().find((s) => s.id === id) ?? null
  const data = await getJson<{ signal: Record<string, unknown> }>(`/api/signals/${encodeURIComponent(id)}`)
  return mapEngineSignal(data.signal)
}

// ── Journal ──────────────────────────────────────────────────────────

export interface RemoteJournalEntry {
  id: string
  symbol: string
  direction: 'long' | 'short'
  setupType: string
  sessionTag: string
  regimeTag: string
  grade: string
  taken: boolean
  resultR?: number
  resultPips?: number
  mistakes: string[]
  notes: string
  createdAt: number
}

export async function fetchJournal(): Promise<RemoteJournalEntry[]> {
  if (!env.apiUrl && isDemoMode) return []
  const data = await getJson<{ entries: RemoteJournalEntry[] }>('/api/journal')
  return data.entries
}

export async function createJournalEntry(entry: Omit<RemoteJournalEntry, 'id' | 'createdAt'>): Promise<RemoteJournalEntry> {
  const data = await postJson<{ entry: RemoteJournalEntry }>('/api/journal', entry)
  return data.entry
}

// ── Analytics ────────────────────────────────────────────────────────

export interface AnalyticsOverviewPayload {
  computedAt: string
  sample: { entries: number; closedTrades: number; skips: number }
  stats: {
    trades: number
    winRate: number
    avgWinR: number
    avgLossR: number
    expectancyR: number
    totalR: number
    profitFactor: number
    maxDrawdownR: number
  }
  stayOut: { skipped: number; goodSkips: number; quality: number; savedR: number }
  equityCurve: { time: number; equityR: number }[]
  gradePerformance: { key: string; label: string; trades: number; winRate: number; expectancyR: number }[]
  winRateByPair: { key: string; label: string; trades: number; winRate: number; expectancyR: number }[]
  blockedReasonFrequency: { reason: string; count: number }[]
}

export function fetchAnalyticsOverview(): Promise<AnalyticsOverviewPayload> {
  return getJson<AnalyticsOverviewPayload>('/api/analytics/overview')
}

export function fetchAnalyticsBySetup() {
  return getJson<{ groups: { key: string; label: string; trades: number; winRate: number; expectancyR: number }[] }>(
    '/api/analytics/by-setup'
  )
}

export function fetchAnalyticsBySession() {
  return getJson<{ groups: { key: string; label: string; trades: number; winRate: number; expectancyR: number }[] }>(
    '/api/analytics/by-session'
  )
}

// ── Subscription / notifications ─────────────────────────────────────

export function fetchSubscriptionStatus(userId: string) {
  return getJson<{ entitlement: { plan: string; status: string; current_period_end: string | null } }>(
    `/api/subscription/status?userId=${encodeURIComponent(userId)}`
  )
}

export function syncSubscription(appUserId: string) {
  return postJson<{ entitlement: { plan: string; status: string } }>('/api/subscription/sync', { appUserId })
}

export function registerPushToken(userId: string, expoPushToken: string, signalAlerts = true) {
  return postJson<{ ok: true }>('/api/notifications/register', { userId, expoPushToken, signalAlerts })
}

// ── Mapping ──────────────────────────────────────────────────────────

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
