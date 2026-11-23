import { NextResponse } from 'next/server'
import { fetchInstrumentGroups } from '@/lib/data/orderbook'
import { errorResponse } from '@/lib/config/runtime'

export const dynamic = 'force-dynamic'
export const maxDuration = 20

// GET /api/orderbook/instruments — the instruments that have a live exchange
// book right now, grouped by asset class (Forex / Crypto / Stocks). Validated
// against Kraken's live pair list so every option resolves.
export async function GET() {
  try {
    const { groups, validated } = await fetchInstrumentGroups()
    return NextResponse.json({
      ok: true,
      validated,
      groups,
      note: validated
        ? 'Grouped by asset class. Only instruments Kraken currently lists a live book for are shown.'
        : 'Showing the full candidate list (could not validate against the exchange just now).',
    })
  } catch (e) {
    const { body, status } = errorResponse(e)
    return NextResponse.json(body, { status })
  }
}
