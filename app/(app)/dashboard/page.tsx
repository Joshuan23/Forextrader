'use client'

import { useEffect, useState, useCallback } from 'react'
import { Header } from '@/components/layout/Header'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { PairTable } from '@/components/dashboard/PairTable'
import { RecentTrades } from '@/components/dashboard/RecentTrades'
import { PriceChart } from '@/components/charts/PriceChart'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Candle, LivePrice } from '@/types/forex'
import { formatCurrency, formatPercent } from '@/lib/utils'
import { RefreshCw } from 'lucide-react'

export default function DashboardPage() {
  const [candles, setCandles] = useState<Candle[]>([])
  const [livePrice, setLivePrice] = useState<LivePrice | null>(null)
  const [selectedPair, setSelectedPair] = useState('EUR/USD')
  const [loading, setLoading] = useState(true)

  const fetchPriceData = useCallback(async (pair: string) => {
    try {
      const res = await fetch(`/api/prices?pair=${encodeURIComponent(pair)}&timeframe=1h&count=200`)
      if (res.ok) {
        const data = await res.json()
        setCandles(data.candles)
        setLivePrice(data.livePrice)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchPriceData(selectedPair)
    const interval = setInterval(() => fetchPriceData(selectedPair), 2000)
    return () => clearInterval(interval)
  }, [selectedPair, fetchPriceData])

  const pairDigits = selectedPair.includes('JPY') ? 3 : 4

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Dashboard" subtitle="Live Market Overview" />

      <main className="flex-1 p-6 space-y-6">
        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Total Balance"
            value="$10,000.00"
            subvalue="Demo Account"
            trend="neutral"
          />
          <MetricCard
            label="Day's P&L"
            value={livePrice ? formatCurrency(livePrice.changeAbs * 10000 * 0.001) : '$0.00'}
            subvalue={livePrice ? formatPercent(livePrice.change) : '+0.00%'}
            trend={livePrice && livePrice.change >= 0 ? 'up' : 'down'}
          />
          <MetricCard
            label="Open Positions"
            value="0"
            subvalue="No open trades"
            trend="neutral"
          />
          <MetricCard
            label="Win Rate"
            value="62.3%"
            subvalue="+3.2% this week"
            trend="up"
          />
        </div>

        {/* Price Chart */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-semibold text-[#e6edf3]">{selectedPair}</h2>
                {livePrice && (
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-bold text-[#e6edf3] tabular-nums">
                      {livePrice.mid.toFixed(pairDigits)}
                    </span>
                    <span
                      className={
                        livePrice.change >= 0 ? 'text-[#3fb950] text-sm font-medium' : 'text-[#f85149] text-sm font-medium'
                      }
                    >
                      {livePrice.change >= 0 ? '+' : ''}{livePrice.change.toFixed(3)}%
                    </span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-[#8b949e]">
                <span>1H Chart</span>
                {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                {livePrice && (
                  <div className="flex items-center gap-3">
                    <span>H: <span className="text-[#e6edf3]">{livePrice.high.toFixed(pairDigits)}</span></span>
                    <span>L: <span className="text-[#e6edf3]">{livePrice.low.toFixed(pairDigits)}</span></span>
                    <span>Bid: <span className="text-[#f85149]">{livePrice.bid.toFixed(pairDigits)}</span></span>
                    <span>Ask: <span className="text-[#3fb950]">{livePrice.ask.toFixed(pairDigits)}</span></span>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
          <CardBody className="p-0 pt-4 pb-2">
            {candles.length > 0 ? (
              <PriceChart candles={candles} height={280} digits={pairDigits} />
            ) : (
              <div className="h-[280px] flex items-center justify-center">
                <RefreshCw className="w-6 h-6 text-[#8b949e] animate-spin" />
              </div>
            )}
          </CardBody>
        </Card>

        {/* Bottom row: PairTable + RecentTrades */}
        <div className="grid grid-cols-1 xl:grid-cols-[55%_44%] gap-4">
          <PairTable onSelectPair={setSelectedPair} selectedPair={selectedPair} />
          <RecentTrades />
        </div>
      </main>
    </div>
  )
}
