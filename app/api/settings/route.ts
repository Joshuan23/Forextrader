import { NextRequest, NextResponse } from 'next/server'
import { getSettings, saveSettings } from '@/lib/store/settings'
import { errorResponse, hasDatabase, isDemoMode } from '@/lib/config/runtime'
import type { FlowEdgeSettings } from '@/lib/engine/types'

export const dynamic = 'force-dynamic'

// GET /api/settings — engine settings + server-side configuration state.
// PUT /api/settings — persist settings (requires real DB unless demo mode).
export async function GET() {
  try {
    const settings = await getSettings()
    return NextResponse.json({
      ok: true,
      settings,
      persisted: hasDatabase(),
      demoMode: isDemoMode(),
      services: {
        database: hasDatabase(),
        oanda: Boolean(process.env.OANDA_API_TOKEN),
        twelveData: Boolean(process.env.TWELVE_DATA_API_KEY),
        alphaVantage: Boolean(process.env.ALPHA_VANTAGE_API_KEY),
        calendar: Boolean(process.env.CALENDAR_API_KEY),
        tradingviewWebhook: Boolean(process.env.TRADINGVIEW_WEBHOOK_SECRET),
        supabaseAdmin: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
        revenueCatSync: Boolean(process.env.REVENUECAT_SECRET_KEY),
      },
    })
  } catch (e) {
    const { body, status } = errorResponse(e)
    return NextResponse.json(body, { status })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const next = (await req.json()) as FlowEdgeSettings
    await saveSettings(next)
    return NextResponse.json({ ok: true })
  } catch (e) {
    const { body, status } = errorResponse(e)
    return NextResponse.json(body, { status })
  }
}
