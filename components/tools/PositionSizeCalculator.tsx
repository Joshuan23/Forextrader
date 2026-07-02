'use client'

import { useEffect, useState } from 'react'
import { CURRENCY_PAIRS, getPairBySymbol } from '@/lib/forex/pairs'
import { calcPositionSize } from '@/lib/proptools/positionSize'

const inputCls =
  'w-full px-3 py-2.5 bg-[#0f1117] border border-[#21262d] rounded-lg text-[#e6edf3] text-sm focus:outline-none focus:border-[#58a6ff]'
const labelCls = 'block text-xs font-medium text-[#8b949e] mb-1.5'

function fmt(n: number, digits = 2): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

export function PositionSizeCalculator({ initialSymbol = 'EUR/USD' }: { initialSymbol?: string }) {
  const [symbol, setSymbol] = useState(initialSymbol)
  const [accountSize, setAccountSize] = useState(10_000)
  const [riskPct, setRiskPct] = useState(1)
  const [stopPips, setStopPips] = useState(20)
  const pair = getPairBySymbol(symbol) ?? CURRENCY_PAIRS[0]
  const [price, setPrice] = useState(pair.basePrice)
  const [priceSource, setPriceSource] = useState<'live' | 'reference'>('reference')

  useEffect(() => {
    const p = getPairBySymbol(symbol)
    if (!p) return
    setPrice(p.basePrice)
    setPriceSource('reference')
    const controller = new AbortController()
    fetch(`/api/prices?pair=${encodeURIComponent(symbol)}&timeframe=1h&count=10`, {
      signal: controller.signal,
    })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data?.livePrice?.mid) {
          setPrice(data.livePrice.mid)
          setPriceSource('live')
        }
      })
      .catch(() => {
        // reference price already set — live quote is best-effort
      })
    return () => controller.abort()
  }, [symbol])

  const result = calcPositionSize({ accountSize, riskPct, stopPips, pair, price })

  return (
    <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Instrument</label>
          <select value={symbol} onChange={e => setSymbol(e.target.value)} className={inputCls}>
            {CURRENCY_PAIRS.map(p => (
              <option key={p.symbol} value={p.symbol}>
                {p.symbol} — {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>
            Price{' '}
            <span className="text-[#484f58]">
              ({priceSource === 'live' ? 'live' : 'reference — edit if needed'})
            </span>
          </label>
          <input
            type="number"
            step="any"
            value={price}
            onChange={e => setPrice(Number(e.target.value))}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Account size (USD)</label>
          <input
            type="number"
            min={0}
            value={accountSize}
            onChange={e => setAccountSize(Number(e.target.value))}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Risk per trade (%)</label>
          <input
            type="number"
            min={0}
            max={100}
            step={0.25}
            value={riskPct}
            onChange={e => setRiskPct(Number(e.target.value))}
            className={inputCls}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Stop-loss distance (pips)</label>
          <input
            type="number"
            min={0}
            value={stopPips}
            onChange={e => setStopPips(Number(e.target.value))}
            className={inputCls}
          />
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-[#21262d] grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
        <div>
          <div className="text-2xl font-bold text-[#58a6ff]">{fmt(result.lots)}</div>
          <div className="text-xs text-[#8b949e] mt-1">Lots</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-[#e6edf3]">{result.units.toLocaleString('en-US')}</div>
          <div className="text-xs text-[#8b949e] mt-1">Units</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-[#e6edf3]">${fmt(result.riskAmount)}</div>
          <div className="text-xs text-[#8b949e] mt-1">Risk amount</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-[#e6edf3]">${fmt(result.usdPerPip)}</div>
          <div className="text-xs text-[#8b949e] mt-1">Per pip</div>
        </div>
      </div>

      <p className="mt-4 text-xs text-[#484f58]">
        Pip value: ${fmt(result.pipValue)} per standard lot. Lots are rounded down to 0.01 so you
        never exceed your intended risk.
      </p>
    </div>
  )
}
