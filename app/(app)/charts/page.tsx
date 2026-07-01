'use client'

import { useEffect, useState, useCallback } from 'react'
import { Header } from '@/components/layout/Header'
import { PriceChart } from '@/components/charts/PriceChart'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Candle, LivePrice, Timeframe } from '@/types/forex'
import { CURRENCY_PAIRS } from '@/lib/forex/pairs'
import { cn } from '@/lib/utils'
import { RefreshCw } from 'lucide-react'

const TIMEFRAMES: { label: string; value: Timeframe; count: number }[] = [
  { label: '1m', value: '1m', count: 200 },
  { label: '5m', value: '5m', count: 200 },
  { label: '15m', value: '15m', count: 200 },
  { label: '1H', value: '1h', count: 200 },
  { label: '4H', value: '4h', count: 200 },
  { label: '1D', value: '1d', count: 200 },
]

export default function ChartsPage() {
  const [selectedPair, setSelectedPair] = useState('EUR/USD')
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>('1h')
  const [candles, setCandles] = useState<Candle[]>([])
  const [livePrice, setLivePrice] = useState<LivePrice | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    const tf = TIMEFRAMES.find((t) => t.value === selectedTimeframe)
    const count = tf?.count ?? 200
    try {
      const res = await fetch(
        `/api/prices?pair=${encodeURIComponent(selectedPair)}&timeframe=${selectedTimeframe}&count=${count}`
      )
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
  }, [selectedPair, selectedTimeframe])

  useEffect(() => {
    setLoading(true)
    fetchData()
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [fetchData])

  const pairDigits = selectedPair.includes('JPY') ? 3 : 4

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Charts" subtitle="Advanced price charts" />

      <main className="flex-1 p-6 space-y-4">
        {/* Controls */}
        <div className="flex flex-wrap gap-3 items-center">
          {/* Pair selector */}
          <select
            className="bg-[#161b22] border border-[#21262d] rounded px-3 py-2 text-sm text-[#e6edf3] focus:outline-none focus:border-[#58a6ff]"
            value={selectedPair}
            onChange={(e) => setSelectedPair(e.target.value)}
          >
            {CURRENCY_PAIRS.map((p) => (
              <option key={p.symbol} value={p.symbol}>{p.symbol}</option>
            ))}
          </select>

          {/* Timeframe buttons */}
          <div className="flex items-center bg-[#161b22] border border-[#21262d] rounded overflow-hidden">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.value}
                onClick={() => setSelectedTimeframe(tf.value)}
                className={cn(
                  'px-3 py-2 text-xs font-medium transition-colors',
                  selectedTimeframe === tf.value
                    ? 'bg-[#21262d] text-[#58a6ff]'
                    : 'text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d]/50'
                )}
              >
                {tf.label}
              </button>
            ))}
          </div>

          {livePrice && (
            <div className="flex items-center gap-3 ml-auto text-sm">
              <span className="font-bold text-[#e6edf3] tabular-nums">
                {livePrice.mid.toFixed(pairDigits)}
              </span>
              <span className={livePrice.change >= 0 ? 'text-[#3fb950]' : 'text-[#f85149]'}>
                {livePrice.change >= 0 ? '+' : ''}{livePrice.change.toFixed(3)}%
              </span>
              {loading && <RefreshCw className="w-3.5 h-3.5 text-[#8b949e] animate-spin" />}
            </div>
          )}
        </div>

        {/* Chart */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between text-xs text-[#8b949e]">
              <span className="font-semibold text-[#e6edf3] text-sm">
                {selectedPair} — {selectedTimeframe.toUpperCase()}
              </span>
              {livePrice && (
                <div className="flex items-center gap-4">
                  <span>O: <span className="text-[#e6edf3]">{candles[candles.length - 1]?.open.toFixed(pairDigits)}</span></span>
                  <span>H: <span className="text-[#3fb950]">{livePrice.high.toFixed(pairDigits)}</span></span>
                  <span>L: <span className="text-[#f85149]">{livePrice.low.toFixed(pairDigits)}</span></span>
                  <span>C: <span className="text-[#e6edf3]">{livePrice.mid.toFixed(pairDigits)}</span></span>
                </div>
              )}
            </div>
          </CardHeader>
          <CardBody className="p-0 pt-4 pb-2">
            {candles.length > 0 ? (
              <PriceChart candles={candles} height={420} digits={pairDigits} />
            ) : (
              <div className="h-[420px] flex items-center justify-center">
                <RefreshCw className="w-6 h-6 text-[#8b949e] animate-spin" />
              </div>
            )}
          </CardBody>
        </Card>
      </main>
    </div>
  )
}
