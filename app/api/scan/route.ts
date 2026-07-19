import { NextRequest, NextResponse } from 'next/server'
import { scanMarket, getSessionInfo, getProfile } from '@/lib/engine'
import { getSettings } from '@/lib/store/settings'
import { listJournalEntries } from '@/lib/store/journal'
import { errorResponse } from '@/lib/config/runtime'

export const dynamic = 'force-dynamic'

// Full market scan as JSON — the same engine output the pages render.
// ?full=1 returns complete evaluations (session info, profile, layer
// scores, derivations) — the web pages' data source, so the engine and
// stores run ONLY on the server against real data.
export async function GET(req: NextRequest) {
  let settings, journal
  try {
    ;[settings, journal] = await Promise.all([getSettings(), listJournalEntries()])
  } catch (e) {
    const { body, status } = errorResponse(e)
    return NextResponse.json(body, { status })
  }
  const evals = await scanMarket(settings, journal)

  if (req.nextUrl.searchParams.get('full') === '1') {
    return NextResponse.json({
      scannedAt: new Date().toISOString(),
      session: getSessionInfo(),
      profile: getProfile(settings.activeProfileId),
      settings,
      evals,
    })
  }

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
