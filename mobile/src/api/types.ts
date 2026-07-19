// Serialized signal shape the mobile app consumes — a stable subset of the
// web engine's EngineSignal, safe to bundle and to fetch from /api/scan.

export type Direction = 'long' | 'short'
export type Grade = 'A' | 'B' | 'C' | 'blocked'

export interface MobileSignal {
  id: string
  pair: string
  timeframe: string
  direction: Direction
  setupType: string
  entryType: string
  grade: Grade
  confidence: number
  status: 'approved' | 'blocked'
  session: string
  regime: string
  htfBias: string
  eventRisk: string
  spreadPips: number
  entry: number
  stopLoss: number
  takeProfit1: number
  takeProfit2: number
  takeProfit3?: number | null
  rrTp1: number
  rrTp2: number
  confidenceEquation: string
  blockReasons: string[]
  invalidation: string
  explanation: string
  layerScores: { label: string; score: number; rule: string }[]
  derivations: { level: string; value: number; formula: string; computation: string }[]
  createdAt: number
  expiresAt: number
}

export interface JournalRow {
  id: string
  pair: string
  direction: Direction
  setupType: string
  session: string
  grade: Grade
  taken: boolean
  resultR?: number
  resultPips?: number
  mistakes: string[]
  notes: string
  screenshotUrl?: string
  createdAt: number
}
