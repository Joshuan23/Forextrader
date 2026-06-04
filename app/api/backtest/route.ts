import { NextRequest, NextResponse } from 'next/server'
import { runBacktest } from '@/lib/backtesting/engine'
import { BacktestConfig } from '@/types/forex'

export async function POST(request: NextRequest) {
  try {
    const config: BacktestConfig = await request.json()
    const result = runBacktest(config)
    return NextResponse.json(result)
  } catch (err) {
    console.error('Backtest error:', err)
    return NextResponse.json({ error: 'Failed to run backtest' }, { status: 500 })
  }
}
