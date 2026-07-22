import type { EngineSignal, FlowEdgeSettings, PairEvaluation } from '@/lib/engine/types'
import type { JournalRecord } from '@/lib/engine/expectancy'
import type { getProfile, getSessionInfo } from '@/lib/engine'

// Browser-side API client for the web app. Pages fetch real server data
// through these — no store imports, no engine execution, and no seeded
// demo data ever reach the client bundle. Server errors (including
// SetupError guidance like "DATABASE_URL is not configured") surface as
// ApiError so pages can render the actual problem.

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly setup: boolean
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' })
  const data = (await res.json().catch(() => null)) as ({ ok?: boolean; error?: string; setup?: boolean } & T) | null
  if (!res.ok || data === null || data.ok === false) {
    throw new ApiError(data?.error ?? `Request failed: HTTP ${res.status}`, res.status, Boolean(data?.setup))
  }
  return data
}

export interface FullScan {
  scannedAt: string
  session: ReturnType<typeof getSessionInfo>
  profile: ReturnType<typeof getProfile>
  settings: FlowEdgeSettings
  evals: PairEvaluation[]
}

export function fetchFullScan(): Promise<FullScan> {
  return getJson<FullScan>('/api/scan?full=1')
}

export async function fetchInboxSignals(limit = 20): Promise<EngineSignal[]> {
  const data = await getJson<{ signals: EngineSignal[] }>(`/api/signals/inbox?limit=${limit}`)
  return data.signals
}

export async function fetchJournal(): Promise<JournalRecord[]> {
  const data = await getJson<{ entries: JournalRecord[] }>('/api/journal')
  return data.entries
}

export interface SettingsResponse {
  settings: FlowEdgeSettings
  persisted: boolean
  demoMode: boolean
  services: Record<string, boolean>
}

export function fetchSettings(): Promise<SettingsResponse> {
  return getJson<SettingsResponse>('/api/settings')
}

export interface IctWatchPair {
  symbol: string
  name?: string
  status?: string
  provider?: string
  bias?: 'armed_long' | 'armed_short' | 'neutral'
  lastClose?: number | null
  htfBias?: 'up' | 'down' | 'neutral'
  killZone?: 'london' | 'newyork' | 'off'
  inKillZone?: boolean
  sweepLevel?: number | null
  mssTarget?: number | null
  pipsToTarget?: number | null
  confluencesReady?: string[]
  confluenceScore?: number
  entry?: number | null
  stopLoss?: number | null
  takeProfit?: number | null
  riskReward?: number | null
  riskPips?: number | null
  waitingFor?: string
  liquidity?: { above: { price: number; percent: number }[]; below: { price: number; percent: number }[] } | null
  drawOnLiquidity?: string | null
}

export interface IctWatchResponse {
  scannedAt: string
  timeframe: string
  note: string
  pairs: IctWatchPair[]
}

export function fetchIctWatch(): Promise<IctWatchResponse> {
  return getJson<IctWatchResponse>('/api/ict/watch')
}

export interface Poi {
  kind: 'FVG' | 'OrderBlock'
  direction: 'long' | 'short'
  top: number
  bottom: number
  entry: number
  stopLoss: number
  takeProfit: number
  riskReward: number
  distancePips: number
}
export interface PoiPair {
  symbol: string
  name?: string
  status?: string
  lastClose?: number
  pois?: Poi[]
}
export interface PoiResponse {
  scannedAt: string
  timeframe: string
  note: string
  pairs: PoiPair[]
}
export function fetchPoi(): Promise<PoiResponse> {
  return getJson<PoiResponse>('/api/ict/poi')
}

export interface DomBook {
  above: { price: number; percent: number }[]
  below: { price: number; percent: number }[]
}
export interface DomPair {
  symbol: string
  name?: string
  price?: number | null
  orderBook?: DomBook | null
  positionBook?: DomBook | null
  error?: string
}
export interface DomResponse {
  scannedAt: string
  oandaConfigured: boolean
  note: string
  pairs: DomPair[]
}
export function fetchDom(): Promise<DomResponse> {
  return getJson<DomResponse>('/api/ict/dom')
}
