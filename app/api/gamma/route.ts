import { NextRequest, NextResponse } from 'next/server'
import { fetchGex } from '@/lib/data/options-gex'
import { errorResponse } from '@/lib/config/runtime'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// GET /api/gamma?symbol=SPY&expiry=<unix> — dealer gamma exposure (GEX) by
// strike, computed from the live options chain (Yahoo) with Black-Scholes.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams
  const symbol = (q.get('symbol') ?? 'SPY').toUpperCase()
  const expiry = Number(q.get('expiry')) || undefined
  try {
    const gex = await fetchGex(symbol, expiry)
    return NextResponse.json({
      ok: true,
      gex,
      note: 'Dealer GEX computed from the live options chain (CBOE delayed quotes, Yahoo fallback). Call GEX = dealer long gamma (green), Put GEX = dealer short gamma (red). Positive net GEX pins price (walls act as magnets); below the flip level dealers are short gamma and moves accelerate. Open interest updates once per session.',
    })
  } catch (e) {
    const { body, status } = errorResponse(e)
    return NextResponse.json(body, { status })
  }
}
