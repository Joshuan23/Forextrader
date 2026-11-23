import { NextRequest, NextResponse } from 'next/server'
import { fetchExchangeOrderBook, ORDERBOOK_INSTRUMENTS, isOrderBookSupported } from '@/lib/data/orderbook'
import { errorResponse } from '@/lib/config/runtime'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// GET /api/orderbook?symbol=XAU/USD&depth=20 — live Level-2 central limit
// order book from a real exchange (Kraken). No API key required.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams
  const symbol = q.get('symbol') ?? 'XAU/USD'
  const depth = Number(q.get('depth')) || 20

  if (!isOrderBookSupported(symbol)) {
    return NextResponse.json(
      { ok: false, error: `No exchange order book for ${symbol}`, instruments: ORDERBOOK_INSTRUMENTS },
      { status: 422 }
    )
  }
  try {
    const book = await fetchExchangeOrderBook(symbol, depth)
    return NextResponse.json({
      ok: true,
      instruments: ORDERBOOK_INSTRUMENTS,
      book,
      note: 'Live central limit order book from Kraken (real resting bids/asks). Gold is shown via PAX Gold (PAXG), a 1:1 physically-backed token that tracks spot XAU. Depth is exchange liquidity, not OANDA.',
    })
  } catch (e) {
    const { body, status } = errorResponse(e)
    return NextResponse.json({ ...body, instruments: ORDERBOOK_INSTRUMENTS }, { status })
  }
}
