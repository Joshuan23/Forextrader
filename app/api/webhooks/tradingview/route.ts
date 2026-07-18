import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { tradingViewAlertSchema, normalizeAlert } from '@/lib/schemas/tradingview'
import { ingestTradingViewAlert } from '@/lib/engine/ingest'
import { getSettings } from '@/lib/store/settings'
import { listJournalEntries } from '@/lib/store/journal'
import { saveSignal } from '@/lib/store/signals'
import { logWebhook } from '@/lib/store/webhook-log'

export const dynamic = 'force-dynamic'

// POST /api/webhooks/tradingview
// TradingView alert → validate secret → Zod-validate → normalize →
// enrich with app-side context → score → trade plan → persist → respond.

// Simple fixed-window rate limit (per IP). TradingView fires at bar close;
// anything past this is abuse or a runaway alert.
const RATE_LIMIT = 30 // requests
const RATE_WINDOW_MS = 60_000
const buckets = new Map<string, { count: number; windowStart: number }>()

function rateLimited(ip: string): boolean {
  const now = Date.now()
  const b = buckets.get(ip)
  if (!b || now - b.windowStart > RATE_WINDOW_MS) {
    buckets.set(ip, { count: 1, windowStart: now })
    return false
  }
  b.count++
  return b.count > RATE_LIMIT
}

function secretMatches(provided: string): boolean {
  const expected = process.env.TRADINGVIEW_WEBHOOK_SECRET
  if (!expected) return false
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (rateLimited(ip)) {
    return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 })
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    await logWebhook({ sourceIp: ip, valid: false, error: 'invalid_json', payload: null })
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  // Secret check BEFORE logging the payload body against the schema —
  // and never echo the secret back or store it in the audit log.
  const providedSecret =
    typeof raw === 'object' && raw !== null && 'secret' in raw ? String((raw as { secret: unknown }).secret) : ''
  const redacted =
    typeof raw === 'object' && raw !== null ? { ...(raw as Record<string, unknown>), secret: '[redacted]' } : raw

  if (!process.env.TRADINGVIEW_WEBHOOK_SECRET) {
    await logWebhook({ sourceIp: ip, valid: false, error: 'secret_not_configured', payload: redacted })
    return NextResponse.json(
      { ok: false, error: 'TRADINGVIEW_WEBHOOK_SECRET is not configured on the server' },
      { status: 503 }
    )
  }
  if (!secretMatches(providedSecret)) {
    await logWebhook({ sourceIp: ip, valid: false, error: 'bad_secret', payload: redacted })
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const parsed = tradingViewAlertSchema.safeParse(raw)
  if (!parsed.success) {
    const error = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    await logWebhook({ sourceIp: ip, valid: false, error, payload: redacted })
    return NextResponse.json({ ok: false, error: `validation_failed: ${error}` }, { status: 422 })
  }

  const normalized = normalizeAlert(parsed.data)
  if (!normalized.ok) {
    await logWebhook({ sourceIp: ip, valid: false, error: normalized.error, payload: redacted })
    return NextResponse.json({ ok: false, error: normalized.error }, { status: 422 })
  }

  await logWebhook({ sourceIp: ip, valid: true, payload: redacted })

  try {
    const [settings, journal] = await Promise.all([getSettings(), listJournalEntries()])
    if (!settings.pairWhitelist.includes(normalized.value.symbol)) {
      return NextResponse.json(
        { ok: true, decision: 'blocked', reasons: [`${normalized.value.symbol} is not on the pair whitelist`] },
        { status: 200 }
      )
    }

    const signal = await ingestTradingViewAlert(normalized.value, settings, journal)
    await saveSignal(signal)

    return NextResponse.json({
      ok: true,
      decision: signal.status, // "approved" | "blocked"
      signalId: signal.id,
      pair: signal.symbol,
      direction: signal.direction,
      grade: signal.grade,
      confidenceScore: signal.confidence,
      approved: signal.status === 'approved',
      entry: signal.plan.entry,
      stopLoss: signal.plan.stopLoss,
      takeProfit1: signal.plan.takeProfit1,
      takeProfit2: signal.plan.takeProfit2,
      takeProfit3: signal.plan.takeProfit3,
      riskRewardToTp1: signal.plan.rrTp1,
      riskRewardToTp2: signal.plan.riskReward,
      positionSizeLots: signal.plan.positionSizeLots,
      sessionTag: signal.session.tag,
      regimeTag: signal.regime.tag,
      htfBias: signal.htfBias,
      eventRiskStatus: signal.eventRisk.level,
      executionQuality: signal.execution.ok ? (signal.execution.spreadState === 'tight' ? 'good' : 'degraded') : 'poor',
      spreadAtSignal: signal.spreadAtSignal,
      historicalEdgeBoost: signal.historicalEdge?.adjustment ?? 0,
      blockedReasons: signal.blockReasons,
      invalidationRule: signal.plan.invalidationLogic,
      explanation: signal.explanation,
      expiresAt: new Date(signal.expiresAt).toISOString(),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'ingest_failed'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
