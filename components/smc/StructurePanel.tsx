'use client'

import type { SMCAnalysis } from '@/types/smc'
import { formatPrice } from '@/lib/utils'
import { CURRENCY_PAIRS } from '@/lib/forex/pairs'

interface StructurePanelProps {
  analysis: Omit<SMCAnalysis, 'candles'>
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function StructurePanel({ analysis }: StructurePanelProps) {
  const pairConfig = CURRENCY_PAIRS.find((p) => p.symbol === analysis.pair)
  const digits = pairConfig?.digits ?? 5

  const { marketStructure } = analysis

  const biasBadge =
    marketStructure.bias === 'bullish'
      ? 'bg-emerald-500/20 text-emerald-400'
      : marketStructure.bias === 'bearish'
      ? 'bg-red-500/20 text-red-400'
      : 'bg-amber-500/20 text-amber-400'

  const activeOBs = analysis.orderBlocks.filter((ob) => !ob.mitigated).slice(0, 5)
  const activeFVGs = analysis.fairValueGaps.filter((fvg) => !fvg.filled).slice(0, 5)
  const recentSweeps = analysis.sweeps.slice(0, 4)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Left: Market Structure */}
      <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-4 space-y-4">
        <h3 className="text-sm font-semibold text-[#e6edf3] flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-400" />
          Market Structure
        </h3>

        {/* Bias & Leg */}
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${biasBadge}`}>
            {marketStructure.bias.toUpperCase()}
          </span>
          <span className="text-xs text-[#8b949e] bg-[#21262d] px-2 py-1 rounded">
            {marketStructure.currentLeg === 'impulse' ? '⚡ Impulse' : '↩ Retracement'}
          </span>
        </div>

        {/* Fib level */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-[#8b949e]">
            <span>Fibonacci Level</span>
            <span className="text-[#e6edf3]">{marketStructure.fibLevel.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-[#21262d] rounded-full h-1.5">
            <div
              className="h-1.5 rounded-full bg-blue-500 transition-all"
              style={{ width: `${Math.min(100, Math.max(0, marketStructure.fibLevel))}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-[#8b949e]">
            <span>0% (Low)</span>
            <span>50% OTE</span>
            <span>100% (High)</span>
          </div>
        </div>

        {/* Recent BOS / CHOCH */}
        <div className="space-y-2">
          <div className="text-xs text-[#8b949e] font-medium">RECENT BREAKS</div>
          {marketStructure.lastBOS && (
            <div className="flex items-center justify-between text-xs bg-[#21262d] rounded px-3 py-2">
              <span className="font-medium text-blue-400">BOS</span>
              <span
                className={
                  marketStructure.lastBOS.direction === 'bullish'
                    ? 'text-emerald-400'
                    : 'text-red-400'
                }
              >
                {marketStructure.lastBOS.direction.toUpperCase()}
              </span>
              <span className="font-mono text-[#c9d1d9]">
                {formatPrice(marketStructure.lastBOS.brokenLevel, digits)}
              </span>
              <span className="text-[#8b949e]">{timeAgo(marketStructure.lastBOS.time)}</span>
            </div>
          )}
          {marketStructure.lastCHOCH && (
            <div className="flex items-center justify-between text-xs bg-[#21262d] rounded px-3 py-2">
              <span className="font-medium text-purple-400">CHoCH</span>
              <span
                className={
                  marketStructure.lastCHOCH.direction === 'bullish'
                    ? 'text-emerald-400'
                    : 'text-red-400'
                }
              >
                {marketStructure.lastCHOCH.direction.toUpperCase()}
              </span>
              <span className="font-mono text-[#c9d1d9]">
                {formatPrice(marketStructure.lastCHOCH.brokenLevel, digits)}
              </span>
              <span className="text-[#8b949e]">{timeAgo(marketStructure.lastCHOCH.time)}</span>
            </div>
          )}
          {!marketStructure.lastBOS && !marketStructure.lastCHOCH && (
            <div className="text-xs text-[#8b949e] italic">No recent structure breaks</div>
          )}
        </div>
      </div>

      {/* Right: Institutional Levels */}
      <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-4 space-y-4">
        <h3 className="text-sm font-semibold text-[#e6edf3] flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          Institutional Levels
        </h3>

        {/* Active Order Blocks */}
        <div className="space-y-2">
          <div className="text-xs text-[#8b949e] font-medium">
            ORDER BLOCKS ({activeOBs.length} active)
          </div>
          {activeOBs.length === 0 ? (
            <div className="text-xs text-[#8b949e] italic">No active order blocks</div>
          ) : (
            <div className="space-y-1">
              {activeOBs.map((ob) => (
                <div
                  key={ob.id}
                  className="flex items-center justify-between text-xs bg-[#21262d] rounded px-3 py-1.5"
                >
                  <span
                    className={ob.type === 'bullish' ? 'text-emerald-400' : 'text-red-400'}
                  >
                    {ob.type === 'bullish' ? '▲' : '▼'} {ob.type.toUpperCase()}
                  </span>
                  <span className="font-mono text-[#c9d1d9]">
                    {formatPrice(ob.low, digits)} – {formatPrice(ob.high, digits)}
                  </span>
                  <span
                    className={`text-xs font-semibold ${
                      ob.strength === 'strong'
                        ? 'text-emerald-400'
                        : ob.strength === 'medium'
                        ? 'text-amber-400'
                        : 'text-[#8b949e]'
                    }`}
                  >
                    {ob.strength}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Unfilled FVGs */}
        <div className="space-y-2">
          <div className="text-xs text-[#8b949e] font-medium">
            FAIR VALUE GAPS ({activeFVGs.length} unfilled)
          </div>
          {activeFVGs.length === 0 ? (
            <div className="text-xs text-[#8b949e] italic">No unfilled FVGs</div>
          ) : (
            <div className="space-y-1">
              {activeFVGs.map((fvg) => (
                <div
                  key={fvg.id}
                  className="flex items-center justify-between text-xs bg-[#21262d] rounded px-3 py-1.5"
                >
                  <span
                    className={fvg.type === 'bullish' ? 'text-emerald-400' : 'text-red-400'}
                  >
                    {fvg.type === 'bullish' ? '▲' : '▼'} {fvg.type.toUpperCase()}
                  </span>
                  <span className="font-mono text-[#c9d1d9]">
                    {formatPrice(fvg.bottom, digits)} – {formatPrice(fvg.top, digits)}
                  </span>
                  <span className="text-amber-400 text-xs">{fvg.sizeInPips.toFixed(1)}p</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Sweeps */}
        <div className="space-y-2">
          <div className="text-xs text-[#8b949e] font-medium">
            RECENT SWEEPS ({recentSweeps.length})
          </div>
          {recentSweeps.length === 0 ? (
            <div className="text-xs text-[#8b949e] italic">No recent sweeps</div>
          ) : (
            <div className="space-y-1">
              {recentSweeps.map((sweep, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-xs bg-[#21262d] rounded px-3 py-1.5"
                >
                  <span
                    className={
                      sweep.type === 'low_sweep' ? 'text-emerald-400' : 'text-red-400'
                    }
                  >
                    {sweep.type === 'low_sweep' ? '↓' : '↑'}{' '}
                    {sweep.type === 'low_sweep' ? 'LOW SWEEP' : 'HIGH SWEEP'}
                  </span>
                  <span className="font-mono text-[#c9d1d9]">{formatPrice(sweep.price, digits)}</span>
                  <span className="text-purple-400">{sweep.pipsSwept.toFixed(1)}p</span>
                  {sweep.reversed && (
                    <span className="text-emerald-400 font-semibold">REV</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
