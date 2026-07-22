import { NextRequest, NextResponse } from 'next/server'
import { diagnoseOanda } from '@/lib/data/oanda'

export const dynamic = 'force-dynamic'

// GET /api/oanda/diag?key=CRON_SECRET — shows exactly why OANDA is/ isn't
// connecting (env set? which environment? HTTP status from a live call).
// Never returns the token. Protected by CRON_SECRET.
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return process.env.NODE_ENV !== 'production'
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${secret}` || req.nextUrl.searchParams.get('key') === secret
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  const pair = req.nextUrl.searchParams.get('pair') ?? 'EUR/USD'
  const diag = await diagnoseOanda(pair)
  return NextResponse.json({
    ok: true,
    oandaUrlEnvSet: Boolean(process.env.OANDA_API_URL),
    diagnosis: diag,
    hint:
      'candlesStatus 200 = OANDA works (provider should be oanda). 401 = bad/expired token. 403 = token valid but account lacks API access or wrong environment (live token on practice URL, or vice-versa).',
  })
}
