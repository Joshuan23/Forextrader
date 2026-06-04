import { NextResponse } from 'next/server'
import { Account } from '@/types/forex'

export async function GET() {
  // Small random variation to simulate live equity changes
  const variation = (Math.random() - 0.5) * 200
  const balance = 10000
  const openPnl = parseFloat(variation.toFixed(2))
  const equity = parseFloat((balance + openPnl).toFixed(2))
  const margin = 500
  const freeMargin = parseFloat((equity - margin).toFixed(2))
  const marginLevel = parseFloat(((equity / margin) * 100).toFixed(1))

  const account: Account = {
    balance,
    equity,
    margin,
    freeMargin,
    marginLevel,
    openPnl,
  }

  return NextResponse.json(account)
}
