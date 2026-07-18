import { NextResponse } from 'next/server'
import { scanMarket } from '@/lib/engine'
import { getSettings } from '@/lib/store/settings'
import { listJournalEntries } from '@/lib/store/journal'

export const dynamic = 'force-dynamic'

// Full market scan as JSON — the same engine output the pages render.
// Useful for external automation (alerts, bots) and client refresh.
export async function GET() {
  const [settings, journal] = await Promise.all([getSettings(), listJournalEntries()])
  const evals = await scanMarket(settings, journal)

  return NextResponse.json({
    scannedAt: new Date().toISOString(),
    profile: settings.activeProfileId,
    pairs: evals.map((e) => ({
      symbol: e.symbol,
      price: e.price,
      changePct: e.changePct,
      rankScore: e.rankScore,
      regime: e.regime.tag,
      session: e.session.tag,
      eventRisk: e.eventRisk.level,
      dataSource: e.dataSource,
      signals: e.signals,
      blocked: e.blocked.map((b) => ({
        id: b.id,
        symbol: b.symbol,
        direction: b.direction,
        setupType: b.setupType,
        confidence: b.confidence,
        blockReasons: b.blockReasons,
      })),
    })),
  })
}
