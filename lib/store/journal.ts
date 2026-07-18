import { getPairBySymbol, CURRENCY_PAIRS } from '@/lib/forex/pairs'
import type { JournalRecord } from '@/lib/engine/expectancy'
import { MISTAKE_TAGS, type Direction, type Grade, type RegimeTag, type SessionTag, type SetupType } from '@/lib/engine/types'

// Journal store — Prisma-backed when DATABASE_URL is set; otherwise a
// seeded in-memory book of realistic history so the journal, analytics
// and expectancy views are meaningful in local development.
// Safely defers database access to avoid bundle issues in browser builds.

const globalStore = globalThis as unknown as { flowedgeJournal?: JournalRecord[] }

// ─── Mock seed ───────────────────────────────────────────────────────

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(rnd: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rnd() * arr.length)]
}

function seedJournal(): JournalRecord[] {
  const rnd = mulberry32(0x51_f1_0e)
  const pairs = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'XAU/USD', 'AUD/USD', 'USD/CAD']
  const setups: SetupType[] = [
    'pullback_continuation',
    'orderblock_mitigation',
    'breakout_retest',
    'liquidity_sweep_reversal',
    'range_fade',
  ]
  const sessions: SessionTag[] = ['asia', 'london', 'newyork', 'london_ny_overlap']
  const regimes: RegimeTag[] = ['trending_up', 'trending_down', 'ranging', 'quiet']
  const now = Date.now()
  const entries: JournalRecord[] = []

  for (let i = 0; i < 56; i++) {
    const daysAgo = 1 + rnd() * 75
    const createdAt = now - daysAgo * 24 * 60 * 60 * 1000
    const symbol = pick(rnd, pairs)
    const pair = getPairBySymbol(symbol)
    const setupType = pick(rnd, setups)
    const sessionTag = pick(rnd, sessions)
    const regimeTag = pick(rnd, regimes)
    const gradeRoll = rnd()
    const grade: Grade = gradeRoll < 0.3 ? 'A' : gradeRoll < 0.7 ? 'B' : 'C'
    const direction: Direction = rnd() < 0.5 ? 'long' : 'short'
    const taken = rnd() < 0.78

    // Grade-dependent edge so the analytics tell the intended story:
    // A setups in London/overlap carry real expectancy; C grades bleed.
    let winP = grade === 'A' ? 0.58 : grade === 'B' ? 0.48 : 0.38
    if (sessionTag === 'london' || sessionTag === 'london_ny_overlap') winP += 0.06
    if (sessionTag === 'asia') winP -= 0.07
    const won = rnd() < winP
    const rWin = 1.2 + rnd() * 1.8 // partial at TP1, rest to TP2
    const rLoss = -(0.85 + rnd() * 0.25) // occasionally saved by early exit
    const resultR = Math.round((won ? rWin : rLoss) * 100) / 100
    const riskPips = 12 + rnd() * 25
    const resultPips = Math.round(resultR * riskPips * 10) / 10

    const mistakes: string[] = []
    if (taken && !won && rnd() < 0.45) mistakes.push(pick(rnd, MISTAKE_TAGS))
    if (taken && rnd() < 0.12) mistakes.push(pick(rnd, MISTAKE_TAGS))

    entries.push({
      id: `seed-${i}`,
      symbol,
      direction,
      setupType,
      sessionTag,
      regimeTag,
      grade,
      taken,
      resultR,
      resultPips,
      spreadCostPips: Math.round((pair?.spread ?? 1) * (0.9 + rnd() * 0.4) * 100) / 100,
      slippagePips: Math.round(rnd() * 0.6 * 100) / 100,
      mistakes: [...new Set(mistakes)],
      screenshots: [],
      notes: taken
        ? won
          ? 'Executed per plan.'
          : 'Stopped out; setup was valid, outcome variance.'
        : 'Skipped — context filters said stand down.',
      entryAt: taken ? createdAt : undefined,
      exitAt: taken ? createdAt + (2 + rnd() * 10) * 60 * 60 * 1000 : undefined,
      createdAt,
    })
  }
  return entries.sort((a, b) => b.createdAt - a.createdAt)
}

function memoryStore(): JournalRecord[] {
  if (!globalStore.flowedgeJournal) globalStore.flowedgeJournal = seedJournal()
  return globalStore.flowedgeJournal
}

// ─── Public API ──────────────────────────────────────────────────────

export async function listJournalEntries(): Promise<JournalRecord[]> {
  // In browser or build environment, return seeded memory store
  if (typeof window !== 'undefined') {
    return memoryStore()
  }

  // Only try database access on server side
  let db = null
  try {
    const { getDb } = await import('@/lib/db')
    db = getDb()
  } catch {
    // Ignore errors during build or in browser context
  }

  if (db) {
    const rows = await db.journalEntry.findMany({
      include: { pair: { select: { symbol: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return rows.map((r: typeof rows[number]) => ({
      id: r.id,
      symbol: r.pair.symbol,
      direction: r.direction as Direction,
      setupType: r.setupType as SetupType,
      sessionTag: r.sessionTag as SessionTag,
      regimeTag: r.regimeTag as RegimeTag,
      grade: r.grade as Grade,
      taken: r.taken,
      resultR: r.resultR ?? undefined,
      resultPips: r.resultPips ?? undefined,
      mistakes: r.mistakes,
      screenshots: r.screenshots,
      notes: r.notes,
      signalId: r.signalId ?? undefined,
      entryAt: r.entryAt?.getTime(),
      exitAt: r.exitAt?.getTime(),
      createdAt: r.createdAt.getTime(),
    }))
  }
  return [...memoryStore()]
}

export type NewJournalEntry = Omit<JournalRecord, 'id' | 'createdAt'>

export async function addJournalEntry(entry: NewJournalEntry): Promise<JournalRecord> {
  let db = null
  try {
    const { getDb } = await import('@/lib/db')
    db = getDb()
  } catch {
    // Ignore errors during build or in browser context
  }

  if (db) {
    const pairRow = await ensurePair(entry.symbol)
    const row = await db.journalEntry.create({
      data: {
        pairId: pairRow.id,
        direction: entry.direction,
        setupType: entry.setupType,
        sessionTag: entry.sessionTag,
        regimeTag: entry.regimeTag,
        grade: entry.grade,
        taken: entry.taken,
        resultR: entry.resultR,
        resultPips: entry.resultPips,
        mistakes: entry.mistakes,
        screenshots: entry.screenshots,
        notes: entry.notes,
        entryAt: entry.entryAt ? new Date(entry.entryAt) : undefined,
        exitAt: entry.exitAt ? new Date(entry.exitAt) : undefined,
      },
    })
    return { ...entry, id: row.id, createdAt: row.createdAt.getTime() }
  }
  const record: JournalRecord = {
    ...entry,
    id: `j-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
  }
  memoryStore().unshift(record)
  return record
}

export async function deleteJournalEntry(id: string): Promise<void> {
  let db = null
  try {
    const { getDb } = await import('@/lib/db')
    db = getDb()
  } catch {
    // Ignore errors during build or in browser context
  }

  if (db) {
    await db.journalEntry.delete({ where: { id } }).catch(() => undefined)
    return
  }
  const store = memoryStore()
  const idx = store.findIndex((e) => e.id === id)
  if (idx >= 0) store.splice(idx, 1)
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
