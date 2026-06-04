import { NextResponse } from 'next/server'
import { CURRENCY_PAIRS } from '@/lib/forex/pairs'
import { getLiveRates } from '@/lib/data/provider'

export async function GET() {
  try {
    const pairs = CURRENCY_PAIRS.map((p) => p.symbol)
    const rates = await getLiveRates(pairs)
    return NextResponse.json(rates)
  } catch (error) {
    console.error('Live rates error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
