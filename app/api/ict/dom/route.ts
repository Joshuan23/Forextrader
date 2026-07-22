import { NextResponse } from 'next/server'
import { fetchOrderBook, fetchPositionBook } from '@/lib/data/oanda'
import { getSettings } from '@/lib/store/settings'
import { getPairBySymbol } from '@/lib/forex/pairs'
import { errorResponse } from '@/lib/config/runtime'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// GET /api/ict/dom — retail-forex DOM per whitelisted pair from OANDA's
// order book (resting orders incl. stops) and position book (open
// positions). Both show the % of interest at each price bucket; the biggest
// pools are the resting liquidity price is drawn to.
export async function GET() {
  try {
    const settings = await getSettings()
    const oandaSet = Boolean(process.env.OANDA_API_TOKEN)
    const pairs = await Promise.all(
      settings.pairWhitelist.map(async (symbol) => {
        const cfg = getPairBySymbol(symbol)
        const digits = cfg?.digits ?? 5
        try {
          const [order, position] = await Promise.all([fetchOrderBook(symbol), fetchPositionBook(symbol)])
          const shape = (b: { price: number; percent: number }) => ({ price: Number(b.price.toFixed(digits)), percent: b.percent })
          return {
            symbol,
            name: cfg?.name ?? symbol,
            price: order ? Number(order.price.toFixed(digits)) : position ? Number(position.price.toFixed(digits)) : null,
            orderBook: order ? { above: order.aboveClusters.map(shape), below: order.belowClusters.map(shape) } : null,
            positionBook: position ? { above: position.aboveClusters.map(shape), below: position.belowClusters.map(shape) } : null,
          }
        } catch (e) {
          return { symbol, name: cfg?.name ?? symbol, error: e instanceof Error ? e.message : 'failed' }
        }
      })
    )
    return NextResponse.json({
      ok: true,
      scannedAt: new Date().toISOString(),
      oandaConfigured: oandaSet,
      note: oandaSet
        ? 'Above price = buy-side liquidity (resting sells / shorts’ stops). Below = sell-side liquidity. Biggest % = the pools price hunts.'
        : 'OANDA_API_TOKEN is not configured — order/position book requires OANDA. Set it to enable DOM.',
      pairs,
    })
  } catch (e) {
    const { body, status } = errorResponse(e)
    return NextResponse.json(body, { status })
  }
}
