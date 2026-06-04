'use client'

import { useEffect, useState } from 'react'
import { LivePrice } from '@/types/forex'
import { getAllLivePrices } from '@/lib/forex/data'
import { cn } from '@/lib/utils'
import { Card, CardHeader } from '@/components/ui/Card'

interface PairTableProps {
  onSelectPair?: (pair: string) => void
  selectedPair?: string
}

export function PairTable({ onSelectPair, selectedPair }: PairTableProps) {
  const [prices, setPrices] = useState<LivePrice[]>([])
  const [prevPrices, setPrevPrices] = useState<Record<string, number>>({})
  const [flashMap, setFlashMap] = useState<Record<string, 'up' | 'down'>>({})

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const res = await fetch('/api/prices?pair=ALL')
        // The API returns single pair, let's use client-side data directly
        // Actually generate all live prices on client
        const allPrices = getAllLivePrices()
        
        setFlashMap((prev) => {
          const newFlash: Record<string, 'up' | 'down'> = { ...prev }
          allPrices.forEach((p) => {
            const oldMid = prevPrices[p.pair]
            if (oldMid !== undefined && oldMid !== p.mid) {
              newFlash[p.pair] = p.mid > oldMid ? 'up' : 'down'
            }
          })
          return newFlash
        })

        setPrevPrices((prev) => {
          const updated = { ...prev }
          allPrices.forEach((p) => { updated[p.pair] = p.mid })
          return updated
        })

        setPrices(allPrices)

        // Clear flash after 300ms
        setTimeout(() => setFlashMap({}), 300)
      } catch {
        // ignore
      }
    }

    fetchPrices()
    const interval = setInterval(fetchPrices, 1000)
    return () => clearInterval(interval)
  }, [prevPrices])

  return (
    <Card className="flex flex-col overflow-hidden">
      <CardHeader>
        <h2 className="text-sm font-semibold text-[#e6edf3]">Market Watch</h2>
      </CardHeader>
      <div className="overflow-auto flex-1">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#21262d]">
              <th className="text-left text-[#8b949e] px-4 py-2 font-medium">Symbol</th>
              <th className="text-right text-[#8b949e] px-3 py-2 font-medium">Bid</th>
              <th className="text-right text-[#8b949e] px-3 py-2 font-medium">Ask</th>
              <th className="text-right text-[#8b949e] px-3 py-2 font-medium">Spread</th>
              <th className="text-right text-[#8b949e] px-3 py-2 font-medium">Change</th>
              <th className="text-right text-[#8b949e] px-3 py-2 font-medium">High</th>
              <th className="text-right text-[#8b949e] px-3 py-2 font-medium">Low</th>
            </tr>
          </thead>
          <tbody>
            {prices.map((p) => {
              const isSelected = selectedPair === p.pair
              const flash = flashMap[p.pair]
              const isPositive = p.change >= 0

              return (
                <tr
                  key={p.pair}
                  onClick={() => onSelectPair?.(p.pair)}
                  className={cn(
                    'border-b border-[#21262d]/50 cursor-pointer transition-colors',
                    isSelected
                      ? 'bg-[#21262d]'
                      : 'hover:bg-[#21262d]/50',
                    flash === 'up' && 'bg-[#3fb950]/10',
                    flash === 'down' && 'bg-[#f85149]/10'
                  )}
                >
                  <td className="px-4 py-2.5">
                    <span className="font-medium text-[#e6edf3]">{p.pair}</span>
                  </td>
                  <td className={cn('px-3 py-2.5 text-right tabular-nums', flash === 'down' ? 'text-[#f85149]' : 'text-[#e6edf3]')}>
                    {p.bid}
                  </td>
                  <td className={cn('px-3 py-2.5 text-right tabular-nums', flash === 'up' ? 'text-[#3fb950]' : 'text-[#e6edf3]')}>
                    {p.ask}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[#8b949e] tabular-nums">
                    {p.pair.includes('JPY') ? ((p.ask - p.bid) / 0.01).toFixed(1) : ((p.ask - p.bid) / 0.0001).toFixed(1)}
                  </td>
                  <td
                    className={cn(
                      'px-3 py-2.5 text-right font-medium tabular-nums',
                      isPositive ? 'text-[#3fb950]' : 'text-[#f85149]'
                    )}
                  >
                    {isPositive ? '+' : ''}{p.change.toFixed(3)}%
                  </td>
                  <td className="px-3 py-2.5 text-right text-[#8b949e] tabular-nums">{p.high}</td>
                  <td className="px-3 py-2.5 text-right text-[#8b949e] tabular-nums">{p.low}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
