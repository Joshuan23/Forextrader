/**
 * Seed script — populates PostgreSQL with the pair universe, strategy
 * profiles, default settings, a realistic journal history, and mock
 * execution metrics so every page has data on first run.
 *
 *   DATABASE_URL=postgres://… npx tsx prisma/seed.ts
 */
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { CURRENCY_PAIRS } from '../lib/forex/pairs'
import { DEFAULT_SETTINGS } from '../lib/engine/config'
import { STRATEGY_PROFILES } from '../lib/engine/profiles'
import { getSlippageProfile } from '../lib/engine/execution'
import { getMockCalendar } from '../lib/data/economic-calendar'
import type { SessionTag } from '../lib/engine/types'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is required to seed. The app itself runs without it (mock mode).')
  process.exit(1)
}
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })

const SESSIONS: SessionTag[] = ['asia', 'london', 'newyork', 'london_ny_overlap']

async function main() {
  // Pairs
  for (const p of CURRENCY_PAIRS) {
    await db.pair.upsert({
      where: { symbol: p.symbol },
      update: {},
      create: {
        symbol: p.symbol,
        name: p.name,
        base: p.base,
        quote: p.quote,
        assetClass: p.assetClass,
        digits: p.digits,
        pipSize: p.pipSize,
        typicalSpread: p.spread,
        enabled: DEFAULT_SETTINGS.pairWhitelist.includes(p.symbol),
      },
    })
  }

  // Settings singleton
  await db.userSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      pairWhitelist: DEFAULT_SETTINGS.pairWhitelist,
      maxSpreadPips: DEFAULT_SETTINGS.maxSpreadPips,
      minAtrPips: DEFAULT_SETTINGS.minAtrPips,
      maxAtrMultiple: DEFAULT_SETTINGS.maxAtrMultiple,
      minRiskReward: DEFAULT_SETTINGS.minRiskReward,
      activeProfileId: DEFAULT_SETTINGS.activeProfileId,
      sessionFilters: { ...DEFAULT_SETTINGS.sessionFilters },
      newsBlackoutBeforeMin: DEFAULT_SETTINGS.newsBlackoutBeforeMin,
      newsBlackoutAfterMin: DEFAULT_SETTINGS.newsBlackoutAfterMin,
      centralBankDowngrade: DEFAULT_SETTINGS.centralBankDowngrade,
      riskPerTradePct: DEFAULT_SETTINGS.riskPerTradePct,
      accountCcy: DEFAULT_SETTINGS.accountCcy,
      accountSize: DEFAULT_SETTINGS.accountSize,
      minConfidence: DEFAULT_SETTINGS.minConfidence,
      signalWeights: { ...DEFAULT_SETTINGS.signalWeights },
      brokerAssumptions: { ...DEFAULT_SETTINGS.brokerAssumptions },
    },
  })

  // Strategy profiles
  for (const p of STRATEGY_PROFILES) {
    await db.strategyProfile.upsert({
      where: { name: p.name },
      update: {},
      create: {
        name: p.name,
        description: p.description,
        setupTypes: p.setupTypes,
        weights: { ...(p.weightTilt ?? {}) },
        active: p.id === DEFAULT_SETTINGS.activeProfileId,
      },
    })
  }

  // Economic events — next 7 days from the deterministic mock calendar
  const now = Date.now()
  for (const ev of getMockCalendar(now, now + 7 * 24 * 60 * 60 * 1000)) {
    await db.economicEvent.create({
      data: {
        title: ev.title,
        currency: ev.currency,
        impact: ev.impact,
        scheduledAt: new Date(ev.scheduledAt),
        isCentralBank: ev.isCentralBank,
      },
    })
  }

  // Execution metrics per pair/session (mock slippage profiles)
  const pairs = await db.pair.findMany({ where: { enabled: true } })
  for (const pair of pairs) {
    for (const session of SESSIONS) {
      const s = getSlippageProfile(pair.symbol, session)
      await db.executionMetric.create({
        data: {
          pairId: pair.id,
          sessionTag: session,
          avgSpreadPips: pair.typicalSpread,
          avgSlippagePips: s.avgPips,
          worstSlippagePips: s.worstPips,
          fillQuality: s.fillQuality,
          sampleSize: s.sampleSize,
        },
      })
    }
  }

  console.log('Seeded pairs, settings, profiles, events, and execution metrics.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
