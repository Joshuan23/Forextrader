import { NextRequest, NextResponse } from 'next/server'
import { scanMarket } from '@/lib/engine'
import { getSettings } from '@/lib/store/settings'
import { listJournalEntries } from '@/lib/store/journal'
import { saveSignal } from '@/lib/store/signals'
import { errorResponse } from '@/lib/config/runtime'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Scheduled market scan — the "works while you sleep" job.
// Runs the engine over the whitelist, PERSISTS every approved signal to the
// database (so the Signals page shows fresh engine output without a page
// load), and pushes a notification to entitled mobile users per signal.
//
// Trigger: a scheduler (GitHub Actions / Vercel Cron / cron-job.org) calls
// this with the shared secret. Protected by CRON_SECRET so it can't be
// spammed publicly.
//   Authorization: Bearer <CRON_SECRET>   (preferred — Vercel Cron sends this)
//   or ?key=<CRON_SECRET>
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return process.env.NODE_ENV !== 'production' // dev: open; prod: must set a secret
  const auth = req.headers.get('authorization')
  if (auth === `Bearer ${secret}`) return true
  if (req.nextUrl.searchParams.get('key') === secret) return true
  return false
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  try {
    const [settings, journal] = await Promise.all([getSettings(), listJournalEntries()])
    const evals = await scanMarket(settings, journal)

    const approved = evals.flatMap((e) => e.signals)
    let persisted = 0
    let pushed = 0
    const errors: string[] = []

    for (const signal of approved) {
      try {
        await saveSignal(signal)
        persisted++
        const { notifyApprovedSignal } = await import('@/lib/services/notifications')
        const res = await notifyApprovedSignal(signal)
        pushed += res.sent
      } catch (e) {
        errors.push(`${signal.symbol}: ${e instanceof Error ? e.message : 'error'}`)
      }
    }

    return NextResponse.json({
      ok: true,
      scannedAt: new Date().toISOString(),
      pairsScanned: evals.length,
      approvedSignals: approved.length,
      persisted,
      pushed,
      errors,
    })
  } catch (e) {
    const { body, status } = errorResponse(e)
    return NextResponse.json(body, { status })
  }
}
