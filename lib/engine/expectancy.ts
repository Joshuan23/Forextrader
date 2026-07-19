import type { Direction, Grade, RegimeTag, SessionTag, SetupType } from './types'

// Journal analytics — expectancy feedback loop. Works on plain records so
// the same math runs against Prisma rows or the in-memory mock store.

export interface JournalRecord {
  id: string
  symbol: string
  direction: Direction
  setupType: SetupType
  sessionTag: SessionTag
  regimeTag: RegimeTag
  grade: Grade
  taken: boolean // false = deliberately skipped ("stay out")
  resultR?: number // realised R if taken; hypothetical R if skipped
  resultPips?: number
  spreadCostPips?: number
  slippagePips?: number
  mistakes: string[]
  screenshots: string[]
  notes: string
  signalId?: string
  entryAt?: number
  exitAt?: number
  createdAt: number
}

export interface ExpectancyStats {
  trades: number
  wins: number
  losses: number
  breakeven: number
  winRate: number // 0–1
  avgWinR: number
  avgLossR: number // negative
  expectancyR: number // per trade
  totalR: number
  profitFactor: number
  totalPips: number
  maxDrawdownR: number
}

export interface GroupStats extends ExpectancyStats {
  key: string
  label: string
}

const closed = (e: JournalRecord) => e.taken && typeof e.resultR === 'number'

export function computeExpectancy(entries: JournalRecord[]): ExpectancyStats {
  const results = entries.filter(closed)
  const rs = results.map((e) => e.resultR as number)
  const wins = rs.filter((r) => r > 0.05)
  const losses = rs.filter((r) => r < -0.05)
  const breakeven = rs.length - wins.length - losses.length

  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)
  const winRate = rs.length > 0 ? wins.length / rs.length : 0
  const avgWinR = wins.length > 0 ? sum(wins) / wins.length : 0
  const avgLossR = losses.length > 0 ? sum(losses) / losses.length : 0
  const totalR = sum(rs)
  const grossWin = sum(wins)
  const grossLoss = Math.abs(sum(losses))

  // Max drawdown on the cumulative R curve (chronological).
  const chronological = [...results].sort((a, b) => a.createdAt - b.createdAt)
  let peak = 0
  let equity = 0
  let maxDd = 0
  for (const e of chronological) {
    equity += e.resultR as number
    peak = Math.max(peak, equity)
    maxDd = Math.max(maxDd, peak - equity)
  }

  return {
    trades: rs.length,
    wins: wins.length,
    losses: losses.length,
    breakeven,
    winRate,
    avgWinR: round2(avgWinR),
    avgLossR: round2(avgLossR),
    expectancyR: rs.length > 0 ? round2(totalR / rs.length) : 0,
    totalR: round2(totalR),
    profitFactor: grossLoss > 0 ? round2(grossWin / grossLoss) : grossWin > 0 ? Infinity : 0,
    totalPips: round2(sum(results.map((e) => e.resultPips ?? 0))),
    maxDrawdownR: round2(maxDd),
  }
}

export function groupExpectancy(
  entries: JournalRecord[],
  keyFn: (e: JournalRecord) => string,
  labelFn: (key: string) => string = (k) => k
): GroupStats[] {
  const groups = new Map<string, JournalRecord[]>()
  for (const e of entries) {
    const k = keyFn(e)
    const list = groups.get(k) ?? []
    list.push(e)
    groups.set(k, list)
  }
  return [...groups.entries()]
    .map(([key, list]) => ({ key, label: labelFn(key), ...computeExpectancy(list) }))
    .filter((g) => g.trades > 0)
    .sort((a, b) => b.expectancyR - a.expectancyR)
}

// "Stay out" quality: of the signals deliberately skipped, how many would
// have lost? High share = the discipline filter is adding real money.
export function stayOutQuality(entries: JournalRecord[]): {
  skipped: number
  goodSkips: number
  badSkips: number
  savedR: number
  quality: number // 0–1
} {
  const skips = entries.filter((e) => !e.taken && typeof e.resultR === 'number')
  const good = skips.filter((e) => (e.resultR as number) <= 0)
  const savedR = -good.reduce((s, e) => s + (e.resultR as number), 0)
  return {
    skipped: skips.length,
    goodSkips: good.length,
    badSkips: skips.length - good.length,
    savedR: round2(savedR),
    quality: skips.length > 0 ? round2(good.length / skips.length) : 0,
  }
}

// Execution cost report: average spread+slippage paid, grouped.
export function costAnalysis(entries: JournalRecord[], keyFn: (e: JournalRecord) => string) {
  const groups = new Map<string, JournalRecord[]>()
  for (const e of entries.filter((x) => x.taken)) {
    const k = keyFn(e)
    const list = groups.get(k) ?? []
    list.push(e)
    groups.set(k, list)
  }
  return [...groups.entries()].map(([key, list]) => {
    const spread = list.map((e) => e.spreadCostPips ?? 0)
    const slip = list.map((e) => e.slippagePips ?? 0)
    const avg = (a: number[]) => (a.length > 0 ? a.reduce((x, y) => x + y, 0) / a.length : 0)
    return {
      key,
      trades: list.length,
      avgSpreadPips: round2(avg(spread)),
      avgSlippagePips: round2(avg(slip)),
      totalCostPips: round2(spread.reduce((x, y) => x + y, 0) + slip.reduce((x, y) => x + y, 0)),
    }
  })
}

export function equityCurveR(entries: JournalRecord[]): { time: number; equityR: number }[] {
  const chronological = entries.filter(closed).sort((a, b) => a.createdAt - b.createdAt)
  let equity = 0
  return chronological.map((e) => {
    equity += e.resultR as number
    return { time: e.createdAt, equityR: round2(equity) }
  })
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
